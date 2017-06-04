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

exports.editStore = async (req, res) => {
  // Find the store given the ID
  const store = await Store.findOne({ _id: req.params.id });
  // Confirm they are the owner of the store
  // TODO
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
  const store = await Store.findOne({ slug: req.params.slug });
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
