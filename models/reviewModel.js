const mongoose = require('mongoose');
const Tour = require('./tourModel');

const reviewSchema = new mongoose.Schema(
  {
    review: {
      type: String,
      required: [true, 'Please submit a review.']
      // maxlen: [500, 'Review should be of less than 500 characters.'],
      // minlen: [5, 'Review should be of more than 5 characters.']
    },
    rating: {
      type: Number,
      required: [true, 'Please give a rating.'],
      min: [1.0, 'Rating >= 1.0'],
      max: [5.0, 'Rating <= 5.0'],
      set: val => Math.round(val * 10) / 10
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    //Parent referencing
    tour: {
      type: mongoose.Schema.ObjectId,
      ref: 'Tour',
      require: [true, 'Review must belong to a tour']
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      require: [true, 'Review must have a user']
    }
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

//index for compound uniqueness
reviewSchema.index({ tour: 1, user: 1 }, { unique: true });
//natours.reviews.ensureIndex({ tour: 1, user: 1 }, { unique: true });

//virtual populate: access all Child in Parent referncing

reviewSchema.pre(/^find/, function(next) {
  // this.populate({
  //   path: 'tour',
  //   select: 'name'
  // }).populate({
  //   path: 'user',
  //   select: 'name photo'
  // });  //prevent unnecessary nested populating
  this.populate({
    path: 'user',
    select: 'name photo'
  });
  next();
});

//static function
reviewSchema.statics.calcAverageRatings = async function(tourId) {
  const stats = await this.aggregate([
    {
      $match: { tour: tourId }
    },
    {
      $group: {
        _id: '$tour',
        nRating: { $sum: 1 },
        avgRating: { $avg: '$rating' }
      }
    }
  ]);
  //console.log(stats);
  if (stats.length > 0) {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: stats[0].nRating,
      ratingsAverage: stats[0].avgRating
    });
  } else {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: 0,
      ratingsAverage: 4.5
    });
  }
};

//pre: current review is not in collection so can't use tourId
reviewSchema.post('save', function() {
  //next not needed
  //this points to current reviews
  //constructor to refer to model not yet declared
  this.constructor.calcAverageRatings(this.tour);
});

//findbyIdandUpdate
//findbyIdandDelete
//no save midleware for these
//we can't access query in post for tourId
reviewSchema.pre(/^findOneAnd/, async function(next) {
  this.r = await this.findOne();
  next();
});
//now we have access to tourId
//rev is used to pass data between middlewares
reviewSchema.post(/^findOneAnd/, async function() {
  await this.r.constructor.calcAverageRatings(this.r.tour);
});

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
