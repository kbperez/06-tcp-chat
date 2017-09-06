'use strict'

const bearerAuth = require('../../../lib/bearer-auth-middleware.js');
const AWS = require('aws-sdk');
const s3Upload = require('../../../lib/s3-upload-middleware.js');
const httpErrors = require('http-errors');
const profileRouter = module.exports = new require('express').Router();
const Profile = require('../model/profile.js');
const s3 = new AWS.S3();
let fuzzyRegex = data  => new RegExp(`.*${data.split('').join('.*')}.*`)

profileRouter.post('/profiles', bearerAuth, s3Upload('photo'),  (req, res, next) => {
  new Profile({
    username: req.user.username, 
    photoURI: req.s3Data.Location, 
  })
  .save()
  .then(profile => res.json(profile))
  .catch(next);
});

profileRouter.get('/profiles', bearerAuth, (req, res, next) => {
  Profile.findOne({username: req.user.username})
  .then(profile => {
    if(!profile) 
      return next(httpErrors(404, 'no profile found'))
    res.json(profile)
  })
})

profileRouter.put('/profiles/photo', bearerAuth, s3Upload('photo'), (req, res, next) => {
  let tempProfile;
  Profile.findOne({username: req.user.username})
  .then(profile => {
    if(!profile) 
      return next(httpErrors(404, 'profile not found'));
    tempProfile = profile;
    let objectKey = profile.photoURI.split('/').pop();
    if(!objectKey) return 
    return s3.deleteObject({
      Bucket: process.env.AWS_BUCKET, 
      Key: objectKey, 
    }).promise();
  })
  .then(() => {
    tempProfile.photoURI = req.s3Data.Location
    return tempProfile.save();
  })
  .then(profile => res.json(profile))
  .catch(next)
});

profileRouter.get('/search/profiles', (req, res, next) => {
  let search = req.query

  for(let key in search){
    search[key] = {$regex: fuzzyRegex(search[key])};
  }

  Profile.find(search)
  .limit(500)
  .then(profiles => res.json(profiles))
  .catch(next);
});
