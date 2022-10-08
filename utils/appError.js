class AppError extends Error {
  constructor(message, statusCode) {
    super(message);

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    //OPERATIONAL ERRORS

    //when a new object is created and the constructor is called
    //that functionwill not appear in stackTrace
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
