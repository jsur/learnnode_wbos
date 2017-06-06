const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
const slug = require('slugs');

const storeSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
    required: 'Please enter a store name!'
  },
  slug: String,
  description: {
    type: String,
    trim: true
  },
  tags: [String],
  created: {
    type: Date,
    default: Date.now
  },
  location: {
    type: {
      type: String,
      default: 'Point'
    },
    coordinates: [{
        type: Number,
        required: 'You must supply coordinates!'
    }],
    address: {
      type: String,
      required: 'You must supply an address!'
    }
  },
  photo: String,
  author: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: 'You must supply an author'
  }
}, {
  toJSON: { virtuals: true }, //show virtually populated properties
  toObject: { virtuals: true }
});

//Define our indexes
storeSchema.index({
  name: 'text', //you tell mongo how to index a field, i.e. in what data type
  description: 'text'
});

storeSchema.index({ location: '2dsphere' });

storeSchema.pre('save', async function(next) {
  if (!this.isModified('name')) {
    next(); //skip it
    return; //stop this function from running
  }
  this.slug = slug(this.name);
  // find other stores with the same name
  const slugRegEx = new RegExp(`^(${this.slug})((-[0-9]*$)?)$`, 'i');
  const storesWithSlug = await this.constructor.find( { slug: slugRegEx });
  if(storesWithSlug.length) {
    this.slug = `${this.slug}-${storesWithSlug.length + 1}`;
  }
  next();
});

storeSchema.statics.getTagsList = function() {
  return this.aggregate([
    { $unwind: '$tags' }, //$tags is the field in my Mongo document which I wish to unwind
    { $group: { _id: '$tags', count: { $sum: 1 } } }, //group ids by tags and add a new field called count with their sum in it
    { $sort: { count: -1 } } //sort by desc
  ]);
}

storeSchema.statics.getTopStores = function() {
  return this.aggregate([
    // Look up stores and populate their reviews
    { $lookup:
      {from: 'reviews', localField: '_id', foreignField: 'store', as: 'reviews'}
    },
    // filter only for items that have 2 or more reviews
    { $match: { 'reviews.1': { $exists: true } } }, //reviews.1 means the second item in reviews array exists, i.e. the store has at least 2 reviews
    // Add the average reviews field
    { $project: {
        //average of each of reviews' rating fields.
        //$reviews.rating means that its a field from data being piped in
        photo: '$$ROOT.photo',
        name: '$$ROOT.name',
        reviews: '$$ROOT.reviews',
        slug: '$$ROOT.slug',
        averageRating: { $avg: '$reviews.rating' }
    } },
    // sort it by our new field, highest reviews first
    { $sort: { averageRating: -1 } },
    // limit to at most 10
    { $limit: 10 }
  ])
}

//find reviews where the stores _id property === review store property
//analoguous to an SQL join but virtual, no real connection between collections
storeSchema.virtual('reviews', {
  ref: 'Review', //what model to link
  localField: '_id', //the field in a store needs to match up with foreignField
  foreignField: 'store' //the field in Review to which localField needs to match to
});

function autopopulate(next) {
  this.populate('reviews');
  next();
}

storeSchema.pre('find', autopopulate);
storeSchema.pre('findOne', autopopulate);

module.exports = mongoose.model('Store', storeSchema);
