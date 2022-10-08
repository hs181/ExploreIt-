const mongoose = require('mongoose');
const slugify = require('slugify');
//const User = require('./userModel');
//const validator = require('validator');

//model is like a blueprint for documents: analogus to class
//model is created by schema
const tourSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'A tour must have a name'], //validator
      unique: true,
      trim: true,
      maxlength: [40, 'Too long name (>40 characters)...'], //validator
      minlength: [10, 'Too short name(<10 characters)...'] //validator
      //validate: [validator.isAlpha, 'Name must only contain characters']
    },
    slug: String,
    duration: {
      type: Number,
      required: [true, 'A tour must have a duration']
    },
    maxGroupSize: {
      type: Number,
      required: [true, 'A tour must have a group size']
    },
    difficulty: {
      type: String,
      required: [true, 'A tour must have a difficulty'],
      enum: {
        values: ['easy', 'medium', 'difficult'], //possible values
        message: 'Difficulty is either: easy, medium or difficult'
      }
    },
    ratingsAverage: {
      type: Number,
      default: 4.5,
      min: [1.0, 'Rating >= 1.0'],
      max: [5.0, 'Rating <= 5.0']
    },
    ratingsQuantity: {
      type: Number,
      default: 0
    },
    price: {
      type: Number,
      required: [true, 'A tour must have a price']
    },
    priceDiscount: {
      type: Number,
      //custom validators
      validate: {
        validator: function(val) {
          // will not work while updating
          return val < this.price;
          //price discount should be less than price
        },
        message: 'Discount price ({VALUE}) should be less than price...'
      }
    },
    summary: {
      type: String,
      trim: true, //only for strings to remove whitespaces at beginning and end
      required: [true, 'A tour must have a description']
    },
    description: {
      type: String,
      trim: true
    },
    imageCover: {
      type: String,
      required: [true, 'A tour must have a cover image']
    },
    images: [String],
    createdAt: {
      type: Date,
      default: Date.now(),
      select: false //permanently hide from output
    },
    startDates: [Date],
    secretTour: {
      type: Boolean,
      default: false
    },
    startLocation: {
      //Geo-JSON for geospatial data
      //object for embedding not for schema type options
      type: {
        type: String,
        default: 'Point',
        enum: ['Point']
      },
      coordinates: [Number],
      address: String,
      description: String
    },
    locations: [
      {
        type: {
          type: String,
          default: 'Point',
          enum: ['Point']
        },
        coordinates: [Number],
        //longitude first then latitude
        address: String,
        description: String,
        day: Number
      }
    ],
    //guides: Array //Embedding
    guides: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      }
    ]
    // Child referencing: instead of this virtual populate is used
    // reviews: [
    //   {
    //     type: mongoose.Schema.ObjectId,
    //     ref: 'User'
    //   }
    // ]
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

//compound index
tourSchema.index({ price: 1, ratingsAverage: -1 }); //1 for ascending
tourSchema.index({ slug: 1 });
//need index for geospatial queries
tourSchema.index({ startLocation: '2dsphere' });

// virtual properties: which can be derived from others
// can't be used in queries
tourSchema.virtual('durationWeeks').get(function() {
  return this.duration / 7;
  //not arrow function as we need this
});

//virtual populate
tourSchema.virtual('reviews', {
  ref: 'Review',
  foreignField: 'tour', //in review model
  localField: '_id'
});

//pre-DOCUMENT-middleware
//run before .save() and .create(), not update
tourSchema.pre('save', function(next) {
  //console.log(this);
  this.slug = slugify(this.name, { lower: true });
  next();
});

//Embedding : when role is changed, we will have to check if the tour has the guide as user too
//and need toupdate it
//hence, referncing is preferred
// tourSchema.pre('save', async function(next) {
//   const guidesPromises = this.guides.map(async id => await User.findById(id));
//   this.guides = await Promise.all(guidesPromises);
//   next();
// });

// tourSchema.pre('save', function(next) {
//   console.log('Will save document...');
//   next();
// });
// //post-DOCUMENT-middleware
// //doc: document just saved
// tourSchema.post('save', function(doc, next) {
//   console.log(doc);
//   next();
// });

///QUERY MIDDLEWARE
tourSchema.pre(/^find/, function(next) {
  //execute for all strings starting by find
  // tourSchema.pre('find', function(next) {
  //this is query here
  this.find({ secretTour: { $ne: true } });
  this.start = Date.now();
  next();
});
tourSchema.pre(/^find/, function(next) {
  this.populate({
    path: 'guides',
    select: '-__v -passwordChangedAt'
  });
  //fill up guides field
  next();
});
tourSchema.post(/^find/, function(docs, next) {
  //doc: documents returned by query
  console.log(`Time taken ${Date.now() - this.start} milliseconds`);
  next();
});

///AGGREGATION MIDDLEWARE
// can't use if we have GeoNear: it should be first in the pipeline
// tourSchema.pre('aggregate', function(next) {
//   //add element to beginning of array
//   this.pipeline().unshift({ $match: { secretTour: { $ne: true } } });
//   //console.log(this.pipeline());
//   next();
// });

const Tour = mongoose.model('Tour', tourSchema);

module.exports = Tour;

// const testTour = new Tour({
//   name: 'The Forest Hiker',
//   rating: 4.7,
//   price: 1999
// });

// testTour
//   .save()
//   .then(doc => {
//     console.log(doc);
//   })
//   .catch(err => {
//     console.log('Error', err);
//   });
