# GeoFire — Realtime location queries with Firebase

[![Build Status](https://travis-ci.org/firebase/geofire.svg)](https://travis-ci.org/firebase/geofire)
[![Version](https://badge.fury.io/gh/firebase%2Fgeofire.svg)](http://badge.fury.io/gh/firebase%2Fgeofire)

GeoFire is an open-source JavaScript library that allows you to store and query a set
of items based on their geographic location.

GeoFire uses [Firebase](https://www.firebase.com/) for data
storage, allowing query results to be updated in realtime as they change.
GeoFire does more than just measure the distance between locations; *it
selectively loads only the data near certain locations, keeping your
applications light and responsive*, even with extremely large datasets.

## Live Examples

To see GeoFire in action, you can [play around with our fully-featured demo](https://geofire.firebaseapp.com/sfVehicles/index.html). (Drag the purple circle!)
This demo maps all of the San Francisco MUNI vehicles within a certain search radius. You can
drag around the search radius and see the vehicles update in realtime.

[![SF MUNI Demo Image](./examples/sfVehicles/images/sf-vehicles.png)](https://geofire.firebaseapp.com/sfVehicles/index.html)

You can find a full list of our demos [here](https://geofire.firebaseapp.com/index.html)
and view the code for each of them in the [examples directory](./examples/) of this repository.
The examples cover some of the common use cases for GeoFire and explain how to protect your data
using security rules.

## Downloading GeoFire

In order to use GeoFire in your project, you need to include the following files in your HTML:

```html
<!-- RSVP -->
<script src="rsvp.min.js"></script>

<!-- Firebase -->
<script src="https://cdn.firebase.com/js/client/1.0.17/firebase.js"></script>

<!-- GeoFire -->
<script src="https://cdn.firebase.com/libs/geofire/2.1.0/geofire.min.js"></script>
```

Use the URL above to download both the minified and non-minifed versions of GeoFire from the Firebase CDN. You can also download them from the
`/dist/` directory of this GitHub repository. [Firebase](https://www.firebase.com/docs/web-quickstart.html)
and [RSVP](https://github.com/tildeio/rsvp.js/) can be downloaded directly from their respective websites.

You can also install GeoFire via npm or Bower and the dependencies will be downloaded automatically:

```bash
$ npm install geofire --save
```

```bash
$ bower install geofire --save
```

## Getting Started with Firebase

GeoFire requires Firebase in order to store location data. You can [sign up here](https://www.firebase.com/signup/) for a free account.

## API Reference

### GeoFire

A `GeoFire` instance is used to read and write geolocation data to your Firebase and to create queries.

#### new GeoFire(firebaseRef)

Creates and returns a new `GeoFire` instance to manage your location data. Data will stored at
the location pointed to by `firebaseRef`. Note that this `firebaseRef` can point to anywhere in your Firebase.

```JavaScript
// Create a Firebase reference where GeoFire will store its information
var firebaseRef = new Firebase("https://<my_firebase>.firebaseio.com/");

// Create a GeoFire index
var geoFire = new GeoFire(firebaseRef);
```

#### GeoFire.ref()

Returns the `Firebase` instance used to create this `GeoFire` instance.

```JavaScript
var firebaseRef = new Firebase("https://<my_firebase>.firebaseio.com/");
var geoFire = new GeoFire(firebaseRef);

var ref = geoFire.ref()  // ref === firebaseRef
```

#### GeoFire.set(key, location)

Adds the specified `key` - `location` pair to Firebase. If the provided `key`
already exists in this `GeoFire`, it will be overwritten with the new `location`
value. `location` must have the form `[latitude, longitude]`.

Returns a promise which is fulfilled when the new location has been synchronized with the Firebase servers.

`key` must be a string and a [valid Firebase key name](https://www.firebase.com/docs/creating-references.html)

```JavaScript
geoFire.set("some_key", [37.79, -122.41]).then(function() {
  console.log("Provided key has been added to GeoFire");
}, function(error) {
  console.log("Error: " + error);
});
```

#### GeoFire.get(key)

Fetches the location stored for `key`.

Returns a promise fulfilled with the `location` corresponding to the provided `key`.
If `key` does not exist, the returned promise is fulfilled with `null`.

```JavaScript
geoFire.get("some_key").then(function(location) {
  if (location === null) {
    console.log("Provided key is not in GeoFire");
  }
  else {
    console.log("Provided key has a location of " + location);
  }
}, function(error) {
  console.log("Error: " + error);
});
```

#### GeoFire.remove(key)

Removes the provided `key` from this `GeoFire`. Returns a promise fulfilled when
the removal of `key` has been synchronized with the Firebase servers. If the provided
`key` is not present in this `GeoFire`, the promise will still successfully resolve.

This is equivalent to calling `set(key, null)`.

```JavaScript
geoFire.remove("some_key").then(function() {
  console.log("Provided key has been removed from GeoFire");
}, function(error) {
  console.log("Error: " + error);
});
```

#### GeoFire.query(queryCriteria)

Creates and returns a new `GeoQuery` instance with the provided `queryCriteria`.

The `queryCriteria` describe a circular query and must be an object with the following keys:

* `center` - the center of this query, with the form `[latitude, longitude]`
* `radius` - the radius, in kilometers, from the center of this query in which to include results

```JavaScript
var geoQuery = geoFire.query({
  center: [10.38, 2.41],
  radius: 10.5
});
```

### GeoQuery

A standing query that tracks a set of keys matching a criteria. A new `GeoQuery` is created every time you call `GeoFire.query()`.

#### GeoQuery.center()

Returns the `location` signifying the center of this query.

The returned `location` will have the form `[latitude, longitude]`.

```JavaScript
var geoQuery = geoFire.query({
  center: [10.38, 2.41],
  radius: 10.5
});

var center = geoQuery.center();  // center === [10.38, 2.41]
```

#### GeoQuery.radius()

Returns the `radius` of this query, in kilometers.

```JavaScript
var geoQuery = geoFire.query({
  center: [10.38, 2.41],
  radius: 10.5
});

var radius = geoQuery.radius();  // radius === 10.5
```

#### GeoQuery.updateCriteria(newQueryCriteria)

Updates the criteria for this query.

`newQueryCriteria` must be an object containing `center`, `radius`, or both.

```JavaScript
var geoQuery = geoFire.query({
  center: [10.38, 2.41],
  radius: 10.5
});

var center = geoQuery.center();  // center === [10.38, 2.41]
var radius = geoQuery.radius();  // radius === 10.5

geoQuery.updateCriteria({
  center: [-50.83, 100.19],
  radius: 5
});

center = geoQuery.center();  // center === [-50.83, 100.19]
radius = geoQuery.radius();  // radius === 5

geoQuery.updateCriteria({
  radius: 7
});

center = geoQuery.center();  // center === [-50.83, 100.19]
radius = geoQuery.radius();  // radius === 7
```

#### GeoQuery.on(eventType, callback)

Attaches a `callback` to this query which will be run when the provided `eventType` fires. Valid `eventType` values are `ready`, `key_entered`, `key_exited`, and `key_moved`. The `ready` event `callback` is passed no parameters. All other `callbacks` will be passed three parameters:

1. the location's key
2. the location's [latitude, longitude] pair
3. the distance, in kilometers, from the location to this query's center

`ready` fires once when this query's initial state has been loaded from the server.
The `ready` event will fire after all other events associated with the loaded data
have been triggered. `ready` will fire again once each time `updateQuery()` is called, after all new data is loaded and all other new events have been fired.

`key_entered` fires when a key enters this query. This can happen when a key moves from a location outside of this query to one inside of it or when a key is written to `GeoFire` for the first time and it falls within this query.

`key_exited` fires when a key moves from a location inside of this query to one outside of it. If the key was entirely removed from `GeoFire`, both the location and distance passed to the `callback` will be `null`.

`key_moved` fires when a key which is already in this query moves to another location inside of it.

Returns a `GeoCallbackRegistration` which can be used to cancel the `callback`. You can add as many callbacks as you would like for the same `eventType` by repeatedly calling `on()`. Each one will get called when its corresponding `eventType` fires. Each `callback` must be cancelled individually.

```JavaScript
var onReadyRegistration = geoQuery.on("ready", function() {
  console.log("GeoQuery has loaded and fired all other events for initial data");
});

var onKeyEnteredRegistration = geoQuery.on("key_entered", function(key, location, distance) {
  console.log(key + " entered query at " + location + " (" + distance + " km from center)");
});

var onKeyExitedRegistration = geoQuery.on("key_exited", function(key, location, distance) {
  console.log(key + " exited query to " + location + " (" + distance + " km from center)");
});

var onKeyMovedRegistration = geoQuery.on("key_moved", function(key, location, distance) {
  console.log(key + " moved within query to " + location + " (" + distance + " km from center)");
});
```

#### GeoQuery.cancel()

Terminates this query so that it no longer sends location updates. All callbacks attached to this query via `on()` will be cancelled. This query can no longer be used in the future.

```JavaScript
// This example stops listening for all key events in the query once the
// first key leaves the query

var onKeyEnteredRegistration = geoQuery.on("key_entered", function(key, location, distance) {
  console.log(key + " entered query at " + location + " (" + distance + " km from center)");
});

var onKeyExitedRegistration = geoQuery.on("key_exited", function(key, location, distance) {
  console.log(key + " exited query to " + location + " (" + distance + " km from center)");

  // Cancel all of the query's callbacks
  geoQuery.cancel();
});
```

### GeoCallbackRegistration

An event registration which is used to cancel a `GeoQuery.on()` callback when it is no longer needed. A new `GeoCallbackRegistration` is returned every time you call `GeoQuery.on()`.

These are useful when you want to stop firing a callback for a certain `eventType` but do not want to cancel all of the query's event callbacks.

#### GeoCallbackRegistration.cancel()

Cancels this callback registration so that it no longer fires its callback. This has no effect on any other callback registrations you may have created.

```JavaScript
// This example stops listening for new keys entering the query once the
// first key leaves the query

var onKeyEnteredRegistration = geoQuery.on("key_entered", function(key, location, distance) {
  console.log(key + " entered query at " + location + " (" + distance + " km from center)");
});

var onKeyExitedRegistration = geoQuery.on("key_exited", function(key, location, distance) {
  console.log(key + " exited query to " + location + " (" + distance + " km from center)");

  // Cancel the "key_entered" callback
  onKeyEnteredRegistration.cancel();
});
```

### Helper Methods

#### GeoFire.distance(location1, location2)

Static helper method which returns the distance, in kilometers, between `location1` and `location2`.

`location1` and `location1` must have the form `[latitude, longitude]`.

```JavaScript
var location1 = [10.3, -55.3];
var location2 = [-78.3, 105.6];

var distance = GeoFire.distance(location1, location2);  // distance === 12378.536597423461
```

## Promises

GeoFire uses promises when writing and retrieving data. Promises represent the result of a potentially long-running operation and allow code to run asynchronously. Upon completion of the operation, the promise will be "resolved" / "fulfilled" with the operation's result. This result will be passed to the function defined in the promise's `then()` method.

GeoFire uses the lightweight RSVP.js library to provide an implementation of JavaScript promises. If you are unfamiliar with promises, please refer to the [RSVP.js documentation](https://github.com/tildeio/rsvp.js/). Here is a quick example of how to consume a promise:

```JavaScript
promise.then(function(result) {
  console.log("Promise was successfully resolved with the following value: " + result);
}, function(error) {
  console.log("Promise was rejected with the following error: " + error);
})
```

## Contributing

If you'd like to contribute to GeoFire, you'll need to run the following commands to get your environment set up:

```bash
$ git clone https://github.com/firebase/geofire.git
$ npm install -g gulp  # globally intall gulp task runnger
$ npm install          # install local npm build / test dependencies
$ bower install        # install local JavaScript dependencies
$ gulp watch           # watch for source file changes
```

`gulp watch` will watch for changes in the `/src/` directory and lint, concatenate, and minify the source files when a change occurs. The output files - `geofire.js` and `geofire.min.js` - are written to the `/dist/` directory.

You can run the test suite by navigating to `file:///path/to/geofire/tests/TestRunner.html` or via the command line using `gulp test`.
