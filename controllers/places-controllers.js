const fs = require('fs');
const uuid = require('uuid/v4');
const { validationResult } = require('express-validator');
const HttpError = require('../models/http-error');
const Place = require('../models/place');
const User = require('../models/user');
const mongoose = require('mongoose');
const getPlaceById = async (req, res, next) => {
  const placeId = req.params.pid; // { pid: 'p1' }
  let place
  try {
    place = await Place.findById(placeId).exec();
  } catch (err) {
    const error = new HttpError(
      'samething went wrong could not find place',
      500
    )
    return next(error)

  }


  if (!place) {
    const error = new HttpError('Could not find a place for the provided id.', 404);
  }

  res.json({ place: place.toObject({ getters: true }) }); // => { place } => { place: place }
};


const getPlacesByUserId = async (req, res, next) => {
  const userId = req.params.uid;
  let userWithPlaces;
  try {
    userWithPlaces = await User.findById(userId).populate('places');
  } catch (err) {
    const error = new HttpError(
      'Fetching places failed please try again.'
    )
    return next(error);

  }



  if (!userWithPlaces || userWithPlaces.places.length === 0) {
    return next(
      new HttpError('Could not find places for the provided user id.', 404)
    );
  }

  res.json({ places: userWithPlaces.places.map(place => place.toObject({ getters: true })) });
};

const createPlace = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new HttpError('Invalid inputs passed, please check your data.', 422)
    );
  }

  const { title, description,address} = req.body;

  const createdPlace = new Place({
    title,
    description,
    address,
    image: req.file.path,
    creator:req.userData.userId
  });

  let user
  try {
    user = await User.findById(req.userData.userId)
  } catch (err) {
    const error = new HttpError(
      'creating place failed please try again', 500
    )
    return next(error);


  }

  if (!user) {
    const error = new HttpError(
      'could not find user for provided id', 404

    )
    return next(error);

  }
  console.log(createdPlace)
  try {   
    const sess = await mongoose.startSession();
    sess.startTransaction();
    await createdPlace.save(sess);
    user.places.push(createdPlace);
    await user.save(sess);
    await sess.commitTransaction();
  } catch (err) {
    const error = new HttpError(
      'cereating place failed pls try again',
      500
    )

  };

  res.status(201).json({ place: createdPlace });
};

const updatePlace = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new HttpError('Invalid inputs passed, please check your data.', 422));
  }

  const { title, description } = req.body;
  const placeId = req.params.pid;

  let place
  try {
    place = await Place.findById(placeId)

  } catch (err) {
    const error = new HttpError(
      'samething went wrong could not updated', 500
    );
    return next(error);
  }
  if (place.creator.toString() !== req.userData.userId) {
    const error = new HttpError('You are not allowed to edit this place.', 401);
    return next(error);
  }

  place.title = title;
  place.description = description;

  try {
    await place.save()

  } catch (err) {
    const error = new HttpError(
      'samething went wrong could not updated', 500
    );
    return next(error);
  }

  res.status(200).json({ place: place.toObject({ getters: true }) });
};

const deletePlace = async (req, res, next) => {
  const placeId = req.params.pid;
  let place
  try {
    place = await Place.findById(placeId).populate('creator');

  } catch (err) {
    const error = new HttpError(
      'some thing went wrong could not delete place',500
    );
    return next(error);
    
  }

if(!place){
  const error = new HttpError(
    'Could not  find place for this Id.',404
  );
  return next(error);
}

if (place.creator.id !== req.userData.userId) {
  const error = new HttpError(
    'You are not allowed to delete this place.',
    401
  );
  return next(error);
}

const imagePath = place.image;
  try {
    const sess = await mongoose.startSession();
    
    sess.startTransaction();
    await place.remove(sess);
    place.creator.places.pull(place);
    await place.creator.save(sess);
    await sess.commitTransaction();
  } catch (err) {
    const error = new HttpError(
      'Something went wrong, could not delete place.',
      500
    );
    return next(error);
  }
  fs.unlink(imagePath, err => {
    console.log(err);
  });
  res.status(200).json({ message: 'Deleted place.' });
};

exports.getPlaceById = getPlaceById;
exports.getPlacesByUserId = getPlacesByUserId;
exports.createPlace = createPlace;
exports.updatePlace = updatePlace;
exports.deletePlace = deletePlace;


