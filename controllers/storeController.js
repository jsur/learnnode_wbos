const mongoose = require('mongoose');
const Store = mongoose.model('Store');

exports.homePage = (req, res) => {
  res.render('index');
};

exports.addStore = (req, res) => {
  res.render('editStore', { title: 'Add Store' });
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
  //find and update store
  const store = await Store.findOneAndUpdate( { _id: req.params.id }, req.body, {
    new: true, //return new store instead of old one
    runValidators: true //force model to run validators against update
  }).exec();
  req.flash('success', `Successfully update <strong>${store.name}</strong>. <a href="/stores/${store.slug}"> View store -> </a>`);
  res.redirect(`/stores/${store._id}/edit`);
  //redirect to store and tell user it worked
}
