var https = require('https');
var qs = require('querystring');

var SANDBOX_URL = 'www.sandbox.paypal.com';
var REGULAR_URL = 'www.paypal.com';


exports.verify = function verify(params, settings, callback) {
  //Settings are optional, use default settings if not set
  if (typeof callback === 'undefined' && typeof settings === 'function') {
    callback = settings;
    settings = {
      'allow_sandbox': false,
      'raw_body': false
    };
  }

  if (typeof params === 'undefined') {
    process.nextTick(function () {
      callback(new Error('No params were passed to ipn.verify'));
    });
    return;
  }

  var body = '';
  if (settings.raw_body) {
    body = 'cmd=_notify-validate&' + params;
  } else {
    params.cmd = '_notify-validate';
    body = qs.stringify(params);
  }

  var is_test_ipn = false;

  if (body.indexOf('test_ipn') !== -1) {
    var parsedBody = qs.parse(body);
    is_test_ipn = (parsedBody.test_ipn && parsedBody.test_ipn === '1') ? true : false;
  }

  //Set up the request to paypal
  var req_options = {
    host: (is_test_ipn) ? SANDBOX_URL : REGULAR_URL,
    method: 'POST',
    path: '/cgi-bin/webscr',
    headers: {'Content-Length': body.length}
  };

  if (is_test_ipn && !settings.allow_sandbox) {
    process.nextTick(function () {
      callback(new Error('Received request with test_ipn parameter while sandbox is disabled'));
    });
    return;
  }

  var req = https.request(req_options, function paypal_request(res) {
    var data = [];

    res.on('data', function paypal_response(d) {
      data.push(d);
    });

    res.on('end', function response_end() {
      var response = data.join('');

      //Check if IPN is valid
      if (response === 'VERIFIED') {
        callback(null, response);
      } else {
        callback(new Error('IPN Verification status: ' + response));
      }
    });
  });

  //Add the post parameters to the request body
  req.write(body);

  //Request error
  req.on('error', callback);

  req.end();
};
