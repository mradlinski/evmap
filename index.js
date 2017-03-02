var setUrlToPoint = function(point) {
	if (!window.history) {
		return;
	}

	var newUrl = window.location.protocol + "//" +
		window.location.host + window.location.pathname +
		'?lat=' + point.lat +
		'&lng=' + point.lng;

	window.history.replaceState(null, null, newUrl);
};

var openPopup = function(url, title) {
	var height = 400;
	var width = 600;
	var top = (screen.height / 2) - (height / 2);
	var left = (screen.width / 2) - (width / 2);

	return window.open(
		url,
		title,
		'top=' + top +
		',left=' + left +
		',toolbar=0,status=0,width=' + width +
		',height=' + height
	);
};

var getGeolocation = function(callback, opts) {
	opts = opts || {};
	opts.showError = opts.showError !== undefined ? opts.showError : true;
	opts.disableHighAccuracy = opts.disableHighAccuracy !== undefined ? opts.disableHighAccuracy : false;
	opts.retry = opts.retry !== undefined ? opts.retry : true;

	navigator.geolocation.getCurrentPosition(callback, function(err) {
		console.error(err.stack || err);
		Raven.captureException(err);
		if (!opts.retry) {
			if (opts.showError) {
				toastr.error('Sorry, your location could not be retrieved!');
			}
		} else {
			getGeolocation(callback, {
				retry: false,
				disableHighAccuracy: true,
				showError: opts.showError
			});
		}
	}, {
		enableHighAccuracy: !opts.disableHighAccuracy,
		timeout: 3000,
		maximumAge: 600000
	});
};

var initMap = function() {
	var center = FB_EV_MAP.DEFAULT_MAP_CENTER;
	var hasPresetCenter = false;

	if (window.location.search) {
		(function() {
			var latMatch = window.location.search.match(/lat=([+-]?\d+(\.\d+)?)/);
			var lngMatch = window.location.search.match(/lng=([+-]?\d+(\.\d+)?)/);

			if (latMatch && latMatch[1] && lngMatch && lngMatch[1]) {
				center = {
					lat: parseFloat(latMatch[1]),
					lng: parseFloat(lngMatch[1])
				};

				hasPresetCenter = true;
			}
		})();
	}

	var searchContainer = document.getElementById('location-search-container');
	var searchInput = document.getElementById('location-search-input');
	var geolocationButton = document.getElementById('location-button');
	var fbShareButton = document.getElementById('fb-share');
	var twShareButton = document.getElementById('tw-share');

	var map = new Map(document.getElementById('map'), center);

	map.addControl(
		document.getElementById('logo'),
		google.maps.ControlPosition.LEFT_TOP
	);
	map.addControl(
		document.getElementById('branding'),
		google.maps.ControlPosition.LEFT_BOTTOM
	);
	map.addSearchBox(searchInput, searchContainer, function(newCenter) {
		map.moveView(newCenter);
		map.resetZoom();
		setUrlToPoint(newCenter);

		Places.getPlacesNearPoint(newCenter.lat, newCenter.lng, map);
	});
	map.addControl(
		document.getElementById('attribution'),
		google.maps.ControlPosition.BOTTOM_LEFT
	);
	map.addControl(
		twShareButton,
		google.maps.ControlPosition.RIGHT_BOTTOM
	);
	map.addControl(
		fbShareButton,
		google.maps.ControlPosition.RIGHT_BOTTOM
	);

	map.addClickListener(function(event) {
		var lat = event.latLng.lat();
		var lng = event.latLng.lng();
		setUrlToPoint({
			lat: lat,
			lng: lng
		});

		Places.getPlacesNearPoint(lat, lng, map);
	});

	(function() {
		var searchNotifCancelled = false;

		$(searchInput).on('focus', function() {
			searchNotifCancelled = true;
		});

		setTimeout(function() {
			if (searchNotifCancelled) {
				return;
			}

			toastr.success('You can also search for your favourite place in the searchbox in the bottom left corner.', null, {
				timeOut: 5000,
				closeButton: true
			});
		}, 5000);
	})();

	if (navigator.geolocation) {
		if (!hasPresetCenter) {
			getGeolocation(function(position) {
				var lat = position.coords.latitude;
				var lng = position.coords.longitude;

				map.moveView({
					lat: lat,
					lng: lng
				});
				map.resetZoom();
				setUrlToPoint({
					lat: lat,
					lng: lng
				});

				Places.getPlacesNearPoint(lat, lng, map, {
					noNotifs: true
				});
			}, {
				showError: false
			});
		}

		toastr.success('Allow this page to access your location or click on the map to show nearby Facebook events!', 'What is this?', {
			timeOut: 10000,
			closeButton: true
		});

		geolocationButton.addEventListener('click', function() {
			getGeolocation(function(position) {
				var lat = position.coords.latitude;
				var lng = position.coords.longitude;

				map.moveView({
					lat: lat,
					lng: lng
				});
				map.resetZoom();
				setUrlToPoint({
					lat: lat,
					lng: lng
				});

				Places.getPlacesNearPoint(lat, lng, map);
			});
			ga('send', 'event', 'GeolocationButton', 'click');
		});
	} else {
		toastr.success('Click on the map to show nearby Facebook events!', 'What is this?', {
			timeOut: 10000,
			closeButton: true
		});
	}

	Places.getPlacesNearPoint(center.lat, center.lng, map, {
		noNotifs: true
	});

	fbShareButton.onclick = function() {
		openPopup(
			'https://www.facebook.com/dialog/share?app_id=428176257526452' +
				'&display=popup&href=' + encodeURIComponent(window.location.href) +
				'&redirect_uri=' + encodeURIComponent(window.location.href),
			'Share on Facebook'
		);
		ga('send', 'event', 'FacebookShare', 'click');
	};

	twShareButton.onclick = function() {
		openPopup(
			'https://twitter.com/intent/tweet?text=' + encodeURIComponent(window.location.href),
			'Share on Twitter'
		);
		ga('send', 'event', 'TwitterShare', 'click');
	};
};
