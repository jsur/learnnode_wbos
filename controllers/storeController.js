const mongoose = require('mongoose');
const Store = mongoose.model('Store');
const multer = require('multer');
const jimp = require('jimp');
const uuid = require('uuid');

const multerOptions = {
  storage: multer.memoryStorage(), //put the photo only into memory
  fileFilter(req, file, next) {
    const isPhoto = file.mimetype.startsWith('image/');
    if(isPhoto) {
      next(null, true); //This is basically yeah this is fine.
    } else {
      next({ message: 'That filetype isn\'t allowed!' }, false);
    }
  }
};

exports.homePage = (req, res) => {
  res.render('index');
};

exports.addStore = (req, res) => {
  res.render('editStore', { title: 'Add Store' });
}

exports.upload = multer(multerOptions).single('photo');

exports.resize = async (req, res, next) => {
  //check if there's no new file to resize
  if (!req.file) {
    next(); //skip to the next middleware
    return;
  }
  const extension = req.file.mimetype.split('/')[1];
  //make a unique id with uuid
  req.body.photo = `${uuid.v4()}.${extension}`;
  //now we resize
  const photo = await jimp.read(req.file.buffer);
  await photo.resize(800, jimp.AUTO);
  await photo.write(`./public/uploads/${req.body.photo}`);
  //once we've written the photo to the filesystem, keep going
  next();
}

exports.createStore = async (req, res) => {
  req.body.author = req.user._id;
  const store = await (new Store(req.body)).save();
  req.flash('success', `Successfully created ${store.name}. Care to leave a review?`);
  res.redirect(`/store/${store.slug}`);
}

//When using async await, wrap route controller into catchErrors!
//(see index.js)
exports.getStores = async (req, res) => {
  const stores = await Store.find();
  res.render('stores', { title: 'Stores', stores });
}

const confirmOwner = (store, user) => {
  if (!store.author.equals(user._id)) {
    throw Error('You must own a store in order to edit it!');
  }
};

exports.editStore = async (req, res) => {
  // Find the store given the ID
  const store = await Store.findOne({ _id: req.params.id });
  // Confirm they are the owner of the store
  confirmOwner(store, req.user);
  // Render edit form so the user can update their store
  res.render('editStore', { title: 'Edit store', store });
}

exports.updateStore = async (req, res) => {
  //set location data to be a point
  req.body.location.type = 'Point';
  //find and update store
  const store = await Store.findOneAndUpdate( { _id: req.params.id }, req.body, {
    new: true, //return new store instead of old one
    runValidators: true //force model to run validators against update
  }).exec();
  req.flash('success', `Successfully update <strong>${store.name}</strong>. <a href="/stores/${store.slug}"> View store -> </a>`);
  res.redirect(`/stores/${store._id}/edit`);
  //redirect to store and tell user it worked
}

exports.getStoreBySlug = async (req, res, next) => {
  const store = await Store.findOne({ slug: req.params.slug }).populate('author');
  if (!store) return next();
  res.render('store', { store, title: store.name });
};

exports.getStoresByTag = async (req, res) => {
  const tag = req.params.tag;
  const tagQuery = tag || { $exists: true };
  const tagsPromise = Store.getTagsList(); //returns a promise
  const storesPromise = Store.find({ tags: tagQuery }); //returns a promise
  //wait for promises to finish and destructure the result into two variables
  const [tags, stores] = await Promise.all([tagsPromise, storesPromise]);
  res.render('tag', { tags, title: 'Tags', tag, stores });
}

exports.searchStores = async (req, res) => {
  const stores = await Store
  //first find matching stores
  .find({
    $text: {
      $search: req.query.q
    }
  }, {
    score: { $meta: 'textScore' }
  })
  //then sort them
  .sort({
    score: { $meta: 'textScore' } // { $meta: "textScore" } to sort by the computed textScore metadata in descending order. See Metadata Sort for an example.
  })
  //and limit to 5
  .limit(5)
  res.json(stores);
};

exports.mapStores = async (req, res) => {
  const coordinates = [req.query.lng, req.query.lat].map(parseFloat);
  const q = {
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates
        },
        $maxDistance: 10000 //10km
      }
    }
  }

  const stores = await Store.find(q).select('slug name description location').limit(10);
  res.json(stores);
}
