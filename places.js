var Places = (function() {
	var placeLookupTable = {};
	var places = [];

	var loadingBlocked = false;
	var loadingBlockedNotifs = [];
	var timesLoaded = 0;
	var fbLoginPrompted = false;

	var garbageCollectPlaces = function() {
		while (places.length > FB_EV_MAP.MAX_PLACES_DISPLAYED) {
			var p = places.shift();

			p.repr.marker.setMap(null);
			p.repr.infoWindow.setMap(null);

			placeLookupTable[p.place.id] = undefined;
		}
	};

	var isLoadingBlocked = function() {
		return loadingBlocked;
	};

	var getPlacesNearPoint = function(lat, lng, map, opts) {
		opts = opts || {};

		if (isLoadingBlocked()) {
			if (!opts.noNotifs) {
				loadingBlockedNotifs.push(toastr.warning('Still loading, please be patient!', null));
			}
			return false;
		}

		var fbToken = FBLogin.getFBToken();

		if (!fbLoginPrompted && timesLoaded > FB_EV_MAP.EVENT_LOADS_BEFORE_LOGIN_PROMPT && !fbToken) {
			FBLogin.promptFacebookLogin();
			fbLoginPrompted = true;
			return false;
		}

		var loadingToast;
		if (!opts.noNotifs) {
			loadingToast = toastr.info('Loading places and events...', null, {
				timeOut: FB_EV_MAP.API_REQ_TIMEOUT
			});
		}

		loadingBlocked = true;

		$.get({
			url: FB_EV_MAP.API_URL + '/events',
			data: {
				lat: lat,
				lng: lng
			},
			dataType: 'json',
			headers: {
				'fb-token-auth': fbToken ? fbToken : undefined
			},
			timeout: FB_EV_MAP.API_REQ_TIMEOUT
		}).done(function(res) {
			res.forEach(function(p) {
				if (!placeLookupTable[p.id]) {
					var repr = map.addMarkerWithDescription(
						p.location.latitude,
						p.location.longitude,
						null,
						p.description
					);

					placeLookupTable[p.id] = true;

					places.push({
						place: p,
						repr: repr
					});
				}
			});

			garbageCollectPlaces();

			timesLoaded += 1;
		}).fail(function(err) {
			console.error(err.stack || err);
			Raven.captureException(err);

			toastr.error('Sorry, an error occurred! Try again?');

			if (fbToken) {
				FBLogin.resetFBToken();
				FBLogin.promptFacebookLogin();
			}
		}).always(function() {
			loadingBlocked = false;
			if (loadingToast) {
				toastr.clear(loadingToast);
			}

			loadingBlockedNotifs.forEach(function(l) {
				toastr.clear(l);
			});
			loadingBlockedNotifs = [];
		});

		ga('send', 'event', 'Map', 'events_requested');

		return true;
	};

	return {
		getPlacesNearPoint: getPlacesNearPoint,
		isLoadingBlocked: isLoadingBlocked
	};
})();
