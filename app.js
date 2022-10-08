const path = require('path');
const express = require('express');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const compression = require('compression');
const cors = require('cors');

const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');
const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');
const reviewRouter = require('./routes/reviewRoutes');
const bookingRouter = require('./routes/bookingRoutes');
const bookingController = require('./controllers/bookingController');
const viewRouter = require('./routes/viewRoutes');

const app = express();

app.enable('trust proxy');

//engine
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));
// Add headers before the routes are defined
// app.use(function(req, res, next) {
//   // Website you wish to allow to connect
//   res.setHeader('Access-Control-Allow-Origin', '*');

//   // Request methods you wish to allow
//   res.setHeader(
//     'Access-Control-Allow-Methods',
//     'GET, POST, OPTIONS, PUT, PATCH, DELETE'
//   );

//   // Request headers you wish to allow
//   res.setHeader(
//     'Access-Control-Allow-Headers',
//     'X-Requested-With,content-type'
//   );

//   // Set to true if you need the website to include cookies in the requests sent
//   // to the API (e.g. in case you use sessions)
//   res.setHeader('Access-Control-Allow-Credentials', true);

//   // Pass to next layer of middleware
//   next();
// });
////GLOBAL middleware////

// 1) GLOBAL MIDDLEWARES
// Implement CORS
app.use(cors());
// Access-Control-Allow-Origin *
// api.natours.com, front-end natours.com
// app.use(cors({
//   origin: 'https://www.natours.com'
// }))

app.options('*', cors());
// app.options('/api/v1/tours/:id', cors());
//Serving static files
//for static files: public becomes root if no non-static file is found
//app.use(express.static(`${__dirname}/public`));
app.use(express.static(path.join(__dirname, 'public')));

//Set security HTTP
app.use(helmet());
// app.use(function(req, res, next) {
//   res.header('Access-Control-Allow-Origin', '*');
//   res.header('Access-Control-Allow-Headers', 'X-Requested-With');
//   next();
// });

// app.all('*', function(req, res, next) {
//   res.header('Access-Control-Allow-Origin', 'cross-origin');
//   res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
//   res.header('Access-Control-Allow-Headers', 'Content-Type');
//   next();
// });

// Development logging
//console.log(process.env.NODE_ENV);
if (process.env.NODE_ENV === 'development') {
  //process variables available in all files
  app.use(morgan('dev'));
}

//Limit requests from same IP
const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  //100 requests from same IP in an hour
  message: 'Too many requests from this IP. Please try again in an hour'
});
app.use('/api', limiter); //limiter to only /api
// Stripe webhook, BEFORE body-parser, because stripe needs the body as stream
app.post(
  '/webhook-checkout',
  bodyParser.raw({ type: 'application/json' }),
  bookingController.webhookCheckout
);

// Body parser, reading data from body into req.body
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Data sanitization against XSS
app.use(xss());

// Prevent parameter pollution
app.use(
  hpp({
    whitelist: [
      'duration',
      'ratingsQuantity',
      'ratingsAverage',
      'maxGroupSize',
      'difficulty',
      'price'
    ] //duplication allowed
  })
);

app.use(compression());

//Test middleware
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  //   //console.log(req.headers);
  //   console.log(req.cookies);
  //   next(); //very important to call next
  // });

  // const CSP = 'Content-Security-Policy';
  // const POLICY =
  //   "default-src 'self' https://*.mapbox.com ;" +
  //   "base-uri 'self';block-all-mixed-content;" +
  //   "font-src 'self' https: data:;" +
  //   "frame-ancestors 'self';" +
  //   "img-src http://localhost:8000 'self' blob: data:;" +
  //   "object-src 'none';" +
  //   "script-src https: cdn.jsdelivr.net cdnjs.cloudflare.com api.mapbox.com 'self' blob: ;" +
  //   "script-src-attr 'none';" +
  //   "style-src 'self' https: 'unsafe-inline';" +
  //   'upgrade-insecure-requests;';

  // const router = express.Router();

  // router.use((req, res, next) => {
  //   res.setHeader(CSP, POLICY);
  next();
});

//// Routes ////
app.use('/', viewRouter);
app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/reviews', reviewRouter);
app.use('/api/v1/bookings', bookingRouter);

//if request is not yet handled by the above routers
//handle all other requests
app.all('*', (req, res, next) => {
  // // res.status(404).json({
  // //   status: 'fail',
  // //   message: `Can't find ${req.originalUrl} on this server!`
  // // });

  // //creating error
  // const err = new Error(`Can't find ${req.originalUrl} on this server!`);
  // err.status = 'fail';
  // err.statusCode = 404;

  //if argument is passed in next: identified as error
  //control skips all middlewares and goes to error-handling middleware
  //next(err);

  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

//OPERATIONAL ERRORS
//error-handling-middleware
app.use(globalErrorHandler);

module.exports = app;
