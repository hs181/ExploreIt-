const mongoose = require('mongoose');
const crypto = require('crypto'); //built-in
const validator = require('validator');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please enter your name.']
  },
  email: {
    type: String,
    required: [true, 'Please provide your email.'],
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, 'Please provide a valid email.']
  },
  photo: {
    type: String,
    default: 'default.jpg'
  },
  role: {
    type: String,
    enum: ['user', 'guide', 'lead-guide', 'admin'],
    default: 'user'
  },
  password: {
    type: String,
    required: [true, 'Please provide a password.'],
    minlength: [8, 'Too short (<8 characters)...'],
    select: false //won't appear in outputs
  },
  passwordConfirm: {
    type: String,
    required: [true, 'Please confirm your password.'],
    validate: {
      //validates only for CREATE or SAVE
      validator: function(el) {
        return el === this.password;
      },
      message: 'Passwords do not match.'
    }
  },
  passwordChangedAt: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  active: {
    type: Boolean,
    default: true,
    select: false
  }
});

//PRE-MIDDLEWARE on SAVE
//works between receiving data and sent to databse
userSchema.pre('save', async function(next) {
  //only encrypt when passowrd is modified
  if (!this.isModified('password')) return next();

  //Hash the password with cost 12
  this.password = await bcrypt.hash(this.password, 12);
  this.passwordConfirm = undefined;
  //deleting unneccessary field
  next();
});

userSchema.pre('save', function(next) {
  if (!this.isModified('password') || this.isNew) return next();

  this.passwordChangedAt = Date.now() - 1000;
  //1s buffer to save
  // i.e. jwt is not issued before passwordChangedAt is saved
  next();
});

//filter inactive users
userSchema.pre(/^find/, function(next) {
  this.find({ active: { $ne: false } });
  next();
});

//INSTANCE METHOD: available for all documents of collection
userSchema.methods.correctPassword = async function(
  candidatePassword,
  userPassword
) {
  //this.password not available as select:false for password
  //so we need userPassword too as argument
  return await bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    //10 is base, converting ms to sec
    //console.log(changedTimeStamp, JWTTimeStamp);
    return JWTTimestamp < changedTimestamp;
  }
  return false; //NOT changed
};

userSchema.methods.createPasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');
  //resetToken should not be stored directly in database

  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  //console.log({ resetToken }, this.PasswordResetToken);

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; //10 minutes
  //console.log(`reset Token ${resetToken}`);
  return resetToken;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
