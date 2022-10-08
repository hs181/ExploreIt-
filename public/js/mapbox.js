/* eslint-disable */

console.log('Hello from the client side');
const locations = JSON.parse(document.getElementById('map').dataset.locations);
console.log(locations);

mapboxgl.accessToken =
  'pk.eyJ1IjoiaW0taHZzIiwiYSI6ImNsNGh6N2hzeTAyMnkzYm1uYXp3NXVyZG0ifQ.vgynYFmO5Ukrk52awHK9Vg';
var map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v11'
});
