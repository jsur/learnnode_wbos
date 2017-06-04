const passport = require('passport');
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = mongoose.model('User');
const promisify = require('es6-promisify');
const mail = require('../handlers/mail');

exports.login = passport.authenticate('local', {
  failureRedirect: '/login',
  failureFlash: 'Failed Login!',
  successRedirect: '/',
  successFlash: 'You\'ve now logged in.'
});

exports.logout = (req, res) => {
  req.logout();
  req.flash('success', 'You are now logged out!');
  res.redirect('/');
}

exports.isLoggedIn = (req, res, next) => {
  //first check if authenticated
  if(req.isAuthenticated()) {
    next();
    return;
  }
  req.flash('error', 'You must be logged in to do that!');
  res.redirect('/login');
}

exports.forgot = async (req, res) => {
  //see if user exists with email
  const user = await User.findOne({ email: req.body.email });
  if(!user) {
    req.flash('error', 'No account with that email exists!');
    return res.redirect('/login');
  }
  //set reset tokens and expiry on their account
  user.resetPasswordToken = crypto.randomBytes(20).toString('hex');
  user.resetPasswordExpires = Date.now() + 3600000; //1h from now
  await user.save();
  //send an email with the token
  const resetURL = `http://${req.headers.host}/account/reset/${user.resetPasswordToken}`;
  await mail.send({
    user,
    subject: 'Password reset',
    resetURL,
    filename: 'password-reset' //nodemailer is going to look for a filename to use for the HTML for the mail
  });
  req.flash('success', `You have been emailed a password reset link.`);
  //redirect to login page
  res.redirect('/login');
};

exports.reset = async (req, res) => {
  const user = await User.findOne({
    resetPasswordToken: req.params.token,
    resetPasswordExpires: { $gt: Date.now() } //greater than: we're checking for a token that's in the future here
  });
  if (!user) {
    req.flash('error', 'Password reset is invalid or has expired.');
    return res.redirect('/login');
  }
  //if there is a user, show the reset password form
  res.render('reset', { title: 'Reset your password' });
};

exports.confirmedPasswords = (req, res, next) => {
  if (req.body.password === req.body['password-confirm']) {
    next();
    return;
  }
  req.flash('error', 'Passwords do not match!');
  res.redirect('back');
};

exports.update = async (req, res) => {
  const user = await User.findOne({
    resetPasswordToken: req.params.token,
    resetPasswordExpires: { $gt: Date.now() } //greater than: we're checking for a token that's in the future here
  });
  if (!user) {
    req.flash('error', 'Password reset is invalid or has expired.');
    return res.redirect('/login');
  }

  const setPassword = promisify(user.setPassword, user);
  await setPassword(req.body.password);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  const updatedUser = await user.save();
  await req.login(updatedUser); //here we pass a user to Passport's login function and it logs the user in
  req.flash('success', 'Password reset! You are now logged in.');
  res.redirect('/');
};
