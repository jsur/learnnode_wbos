function autocomplete(input, latInput, lngInput) {
  if(!input) return; //skip this from running if no input
  const dropdown = new google.maps.places.Autocomplete(input);

  dropdown.addListener('place_changed', () => {
    const place = dropdown.getPlace();
    latInput.value = place.geometry.location.lat();
    lngInput.value = place.geometry.location.lng();
  });

  // Dont submit form on enter
  input.on('keydown', (e) => {
    if(e.keyCode === 13) e.preventDefault();
  });
}

export default autocomplete;
