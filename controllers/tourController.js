// const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');
const Tour = require('../models/tourModel');
const AppError = require('../utils/appError');
//const APIfeatures = require('./../utils/apiFeatures');
const catchAsync = require('./../utils/catchAsync');
const factory = require('./handlerFactory');

const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new AppError('Not an image! Please upload only images.', 400), false);
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter
});

exports.uploadTourImages = upload.fields([
  { name: 'imageCover', maxCount: 1 },
  { name: 'images', maxCount: 3 }
]);

// upload.single('image') req.file
// upload.array('images', 5) req.files

exports.resizeTourImages = catchAsync(async (req, res, next) => {
  if (!req.files.imageCover || !req.files.images) return next();

  // 1) Cover image
  req.body.imageCover = `tour-${req.params.id}-${Date.now()}-cover.jpeg`;
  await sharp(req.files.imageCover[0].buffer)
    .resize(2000, 1333)
    .toFormat('jpeg')
    .jpeg({ quality: 90 })
    .toFile(`public/img/tours/${req.body.imageCover}`);

  // 2) Images
  req.body.images = [];

  await Promise.all(
    req.files.images.map(async (file, i) => {
      const filename = `tour-${req.params.id}-${Date.now()}-${i + 1}.jpeg`;

      await sharp(file.buffer)
        .resize(2000, 1333)
        .toFormat('jpeg')
        .jpeg({ quality: 90 })
        .toFile(`public/img/tours/${filename}`);

      req.body.images.push(filename);
    })
  );

  next();
});

exports.aliasTopTours = (req, res, next) => {
  req.query.limit = '5';
  req.query.sort = '-ratingsAverage,price';
  req.query.fields = 'name,price,ratingsAverage,summary,difficulty';
  next();
};

exports.getAllTours = factory.getAll(Tour);
exports.getTour = factory.getOne(Tour, { path: 'reviews' });
exports.createTour = factory.createOne(Tour);
exports.updateTour = factory.updateOne(Tour);
exports.deleteTour = factory.deleteOne(Tour);

exports.getTourStats = catchAsync(async (req, res, next) => {
  const stats = await Tour.aggregate([
    {
      $match: { ratingsAverage: { $gte: 4.5 } }
    },
    {
      $group: {
        // _id: null, //one big group
        //_id: '$difficulty',
        _id: { $toUpper: '$difficulty' },
        numTours: { $sum: 1 }, //1 for each document
        numRatings: { $sum: '$ratingsQuantity' },
        avgRating: { $avg: '$ratingsAverage' },
        avgPrice: { $avg: '$price' },
        minPrice: { $min: '$price' },
        maxPrice: { $max: '$price' }
      }
    },
    {
      $sort: { avgPrice: 1 } //ascending
    }
    // {
    //   $match: { _id: { $ne: 'EASY' } }
    // } //can be repeated
  ]);
  res.status(200).json({
    status: 'success',
    data: {
      stats
    }
  });
});

exports.getMonthlyPlan = catchAsync(async (req, res, next) => {
  const year = req.params.year * 1;
  const plan = await Tour.aggregate([
    {
      $unwind: '$startDates'
    },
    {
      $match: {
        startDates: {
          $gte: new Date(`${year}-01-01`),
          $lte: new Date(`${year}-12-31`)
        }
      }
    },
    {
      $group: {
        _id: { $month: '$startDates' },
        numTourStarts: { $sum: 1 },
        tours: { $push: '$name' }
      }
    },
    {
      $addFields: {
        month: '$_id'
      },
    // },
    // {
    //   // $addFields: { month: '$_id' }
    //   $addFields: {
    //     month: {
    //       $let: {
    //         vars: {
    //           // eslint-disable-next-line no-sparse-arrays
    //           monthsInString: [
    //             ,
    //             'Jan',
    //             'Feb',
    //             'Mar',
    //             'Apr',
    //             'May',
    //             'Jun',
    //             'Jul',
    //             'Aug',
    //             'Sep',
    //             'Oct',
    //             'Nov',
    //             'Dec'
    //           ]
    //         },
    //         in: {
    //           $arrayElemAt: ['$$monthsInString', '$month']
    //         }
    //       }
    //     }
    //   }
    // },
    {
      $project: {
        _id: 0 //don't display
      }
    },
    {
      $sort: { numTourStarts: -1 }
    },
    {
      $limit: 12
    }
  ]);
  res.status(200).json({
    status: 'success',
    data: {
      plan
    }
  });
});

// /tours-within/:distance/centre/:latlng/unit/:unit
exports.getToursWithin = catchAsync(async (req, res, next) => {
  const { distance, latlng, unit } = req.params;
  const [lat, lng] = latlng.split(',');
  const radius = unit === 'mi' ? distance / 3963.2 : distance / 6378.1;
  //in radians from miles or km

  if (!lat || !lng) {
    next(
      new AppError('Please provide latitude and longitude (as lat,lng)', 400)
    );
  }

  const tours = await Tour.find({
    startLocation: { $geoWithin: { $centerSphere: [[lng, lat], radius] } }
    //longitude first
  });

  res.status(200).json({
    status: 'success',
    results: tours.length,
    data: tours
  });
});

exports.getDistances = catchAsync(async (req, res, next) => {
  const { latlng, unit } = req.params;
  const [lat, lng] = latlng.split(',');

  const multiplier = unit === 'mi' ? 0.000621371 : 0.001;

  if (!lat || !lng) {
    next(
      new AppError('Please provide latitude and longitude (as lat,lng)', 400)
    );
  }

  const distances = await Tour.aggregate([
    {
      //geoNear should be first stage
      $geoNear: {
        near: {
          type: 'Point',
          coordinates: [lng * 1, lat * 1]
        },
        distanceField: 'distance',
        distanceMultiplier: multiplier
      }
    },
    {
      $project: {
        distance: 1,
        name: 1
      }
    }
  ]);

  res.status(200).json({
    status: 'success',
    data: distances
  });
});

// const tours = JSON.parse(
//   fs.readFileSync(`${__dirname}/../dev-data/data/tours-simple.json`)
// );

// exports.checkID = (req, res, next, val) => {
//   console.log(`Tour id: ${val}`);
//   if (req.params.id * 1 > tours.length) {
//     return res.status(404).json({
//       status: 'fail',
//       message: 'Invalid ID'
//     });
//   }
//   next();
// };

// exports.checkBody = (req, res, next) => {
//   if (req.body.name == null || req.body.price == null) {
//     return res.status(400).json({
//       status: 'fail',
//       message: 'Missing name or price'
//     }); //400: bad request
//   }
//   next();
// };

//put: entire updates object
//patch: only properties to update

// app.get('/api/v1/tours', getAllTours);
// app.post('/api/v1/tours', createTour);

// app.get('/api/v1/tours/:id', getTour)
// app.patch('/api/v1/tours/:id', updateTour);
// app.delete('/api/v1/tours/:id', deleteTour);

// app.get('/', (req, res) => {
//   //res.status(200).send('Hello from the server!');
//   res.status(200).json({ message: 'Hello from the server!', app: 'Natours' });
// });

// app.post('/', (req, res) => {
//   res.status(200).send('Post here!');
// });

//exports.getAllTours = catchAsync(async (req, res, next) => {
//   //console.log(req.requestTime);
//   const features = new APIfeatures(Tour.find(), req.query)
//     .filter()
//     .sort()
//     .limitFields()
//     .paginate();
//   const tours = await features.query;

//   ////SEND RESPONSE
//   res.status(200).json({
//     status: 'success',
//     //requestedAt: req.requestTime
//     results: tours.length,
//     data: {
//       //tours: tours,
//       tours
//     }
//   });
//   // const tours = await Tour.find({
//   //   duration: 5,
//   //   difficulty: 'easy'
//   // });

//   // const tours = await Tour.find()
//   //   .where('duration')
//   //   .equals(5)
//   //   .where('difficulty')
//   //   .equals('easy');

//   // ////BUILDING QUERY
//   // //// 1A) FILTERING
//   // //hard-copying object and not by the address of original object
//   // const queryObj = { ...req.query };
//   // const excludedFields = ['page', 'sort', 'limit', 'fields'];
//   // excludedFields.forEach(el => delete queryObj[el]);

//   // //// 1B) ADVANCED FILTERING
//   // //intended: { duration: {$gte 5}, difficulty: 'easy' }
//   // //received: { duration: {gte '5'}, difficulty: 'easy' }
//   // let queryStr = JSON.stringify(queryObj);
//   // //if we directly await this query we can't use sort and other features
//   // //const tours = await Tour.find(queryObj);
//   // queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, match => `$${match}`);
//   // // \b:exact occurence (not inside some string), /g: multiple replacemets

//   // let query = Tour.find(JSON.parse(queryStr));

//   //// 5)
//   ////EXECUTING QUERY
// });

// exports.getTour = catchAsync(async (req, res, next) => {
//   const tour = await Tour.findById(req.params.id).populate('reviews');

//   if (!tour) {
//     return next(new AppError('No tour find for the id', 404));
//   }
//   res.status(200).json({
//     status: 'success',
//     results: tour.length,
//     data: tour
//   });
//   //add ? for optional parameters
//   //console.log(req.params);
//   //const id = req.params.id * 1; //conversion to integer
//   // const tour = tours.find(el => el.id === id);
//   // //if (id > tours.length) {
//   // // if (!tour) {
//   // //   return res.status(404).json({
//   // //     status: 'fail',
//   // //     message: 'Invalid ID',
//   // //   });
//   // // }
//   // res.status(200).json({
//   //   status: 'success',
//   //   data: { tour }
//   // });
// });

//exports.createTour = catchAsync(async (req, res, next) => {
//   const newTour = await Tour.create(req.body);

//   res.status(201).json({
//     status: 'success',
//     data: {
//       tour: newTour
//     }
//   });

//   // try {
//   //   const newTour = await Tour.create(req.body);

//   //   res.status(201).json({
//   //     status: 'success',
//   //     data: {
//   //       tour: newTour
//   //     }
//   //   });
//   // } catch (err) {
//   //   res.status(400).json({
//   //     status: 'fail',
//   //     message: err
//   //   });
//   // }

//   //console.log(req.body);
//   // const newId = tours[tours.length - 1].id + 1;
//   // const newTour = Object.assign(
//   //   {
//   //     id: newId
//   //   },
//   //   req.body
//   // );
//   // tours.push(newTour);

//   // fs.writeFile(
//   //   `${__dirname}/dev-data/data/tours-simple.json`,
//   //   JSON.stringify(tours),
//   //   err => {
//   //     res.status(201).json({
//   //       status: 'success',
//   //       data: { tour: newTour }
//   //     }); //201 for Created
//   //   }
//   // );
// });
//
//   exports.updateTour = catchAsync(async (req, res, next) => {
//     const tour = await Tour.findByIdAndUpdate(req.params.id, req.body, {
//       new: true,
//       runValidators: true //important to re-run validators
//     });
//     if (!tour) {
//       return next(new AppError('No tour find for the id', 404));
//     }
//     res.status(200).json({
//       status: 'success',
//       data: {
//         tour
//       }
//     });
//   });
//   exports.deleteTour = catchAsync(async (req, res, next) => {
//     const tour = await Tour.findByIdAndDelete(req.params.id);
//     if (!tour) {
//       return next(new AppError('No tour find for the id', 404));
//     }
//     res.status(204).json({
//       status: 'success',
//       data: null
//     });
//   });
//
