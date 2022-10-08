class APIFeatures {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
  }

  filter() {
    ////BUILDING QUERY
    //// 1A) FILTERING
    //hard-copying object and not by the address of original object
    // const queryObj = { ...req.query }; //when inside getAllTours
    const queryObj = { ...this.queryString };
    const excludedFields = ['page', 'sort', 'limit', 'fields'];
    excludedFields.forEach(el => delete queryObj[el]);

    //// 1B) ADVANCED FILTERING
    //intended: { duration: {$gte 5}, difficulty: 'easy' }
    //received: { duration: {gte '5'}, difficulty: 'easy' }
    let queryStr = JSON.stringify(queryObj);
    //if we directly await this query we can't use sort and other features
    //const tours = await Tour.find(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, match => `$${match}`);
    // \b:exact occurence (not inside some string), /g: multiple replacemets

    //let query = Tour.find(JSON.parse(queryStr));
    this.query = this.query.find(JSON.parse(queryStr));

    return this;
    //return entire object to access other methods
  }

  sort() {
    //// 2) SORTING  :descending order: add - before key
    if (this.queryString.sort) {
      //multiple parameters to resolve ties
      const sortBy = this.queryString.sort.split(',').join(' ');
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort('-createdAt');
    }
    return this;
  }

  limitFields() {
    //// 3) LIMITING ,projecting certain fields only ,exclude certaing fields: add-
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(',').join(' ');
      this.query = this.query.select(fields);
    } else {
      this.query = this.query.select('-__v');
    }
    return this;
  }

  paginate() {
    //// 4) PAGINATION
    const page = this.queryString.page * 1 || 1;
    //default value 1
    const limit = this.queryString.limit * 1 || 10;
    const skip = (page - 1) * limit;
    this.query = this.query.skip(skip).limit(limit);

    // if (this.queryString.page) {
    //   const numTours = await Tour.countDocuments();
    //   if (skip >= numTours) throw new Error('Page does not exit!');
    // }
    return this;
  }
}

module.exports = APIFeatures;
