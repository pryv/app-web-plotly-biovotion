/*globals document, pryv, _, Plotly*/
var container = document.getElementById('pryvGraphs');
var monitor;

var pullSerieFrequencyMs = 100;


/**
 * retrieve the registerURL from URL parameters
 */
function getRegisterURL() {
  return pryv.utility.urls.parseClientURL().parseQuery()['reg-pryv'] || pryv.utility.urls.parseClientURL().parseQuery()['pryv-reg'];
}

var customRegisterUrl = getRegisterURL();
if (customRegisterUrl) {
  pryv.Auth.config.registerURL = {host: customRegisterUrl, 'ssl': true};
}

/**
 * retrieve the registerURL from URL parameters
 */
function getSettingsFromURL() {
  var settings = {
    username : pryv.utility.urls.parseClientURL().parseQuery().username,
    domain : pryv.utility.urls.parseClientURL().parseQuery().domain,
    auth: pryv.utility.urls.parseClientURL().parseQuery().auth
  };

  if (settings.username && settings.auth) {
    return settings;
  }

  return null;
}

function setupShareLink(connect) {
  var urlLabel = document.getElementById('sharelink');
  urlLabel.innerHTML = ('' + document.location).split('?')[0] +
    '?username=' + connect.username +
    '&domain=' + connect.domain +
    '&auth=' + connect.auth;
}

document.onreadystatechange = function () {

  document.getElementById('loading').style.display = 'none';
  document.getElementById('logo-pryv').style.display = 'block';
  var state = document.readyState;
  if (state == 'complete') {
    var settings = getSettingsFromURL();
    if (settings) {
      var connection = new pryv.Connection(settings);
      connection.fetchStructure(function () {
        setupMonitor(connection);
      });
    } else {

      // Authenticate user
      var authSettings = {
        requestingAppId: 'appweb-plotly',
        requestedPermissions: [
          {
            streamId: '*',
            level: 'read'
          }
        ],
        returnURL: false,
        spanButtonID: 'pryv-button',
        callbacks: {
          needSignin: resetPlots,
          needValidation: null,
          signedIn: function (connect) {
            connect.fetchStructure(function () {
              setupMonitor(connect);
            });
          }
        }
      };
      pryv.Auth.setup(authSettings);
    }
  }
};

// MONITORING
// Setup monitoring for remote changes
function setupMonitor(connection) {
  setupShareLink(connection);

  document.getElementById('loading').style.display = 'block';
  document.getElementById('logo-pryv').style.display = 'none';
  var filter = new pryv.Filter({limit: 10000});
  monitor = connection.monitor(filter);

  // should be false by default, will be updated in next lib version
  // to use fullCache call connection.ensureStructureFetched before
  monitor.ensureFullCache = false;
  monitor.initWithPrefetch = 0; // default = 100;

  // get presets from stream structure
  connection.streams.walkTree({}, function (stream) { 
    if (stream.clientData && stream.clientData['app-web-plotly']) {
      Object.keys(stream.clientData['app-web-plotly']).forEach(function(eventType) {
        var traceKey = stream.id + '_' + eventType;
        presets[traceKey] = stream.clientData['app-web-plotly'][eventType];
      });
    }
    console.log('Stream:' + stream.id + '->' + JSON.stringify(stream.clientData));
  });


  // get notified when monitoring starts
  monitor.addEventListener(pryv.MESSAGES.MONITOR.ON_LOAD, function (events) {

    document.getElementById('loading').style.display = 'none';
    document.getElementById('logo-pryv').style.display = 'block';
    updatePlot(events);

  });

  // get notified when data changes
  monitor.addEventListener(pryv.MESSAGES.MONITOR.ON_EVENT_CHANGE, function (changes) {
    updatePlot(changes.created);
  });

  // start monitoring
  monitor.start(function (/**err**/) {
  });
}

// Traces
var traces = {}; // Container for "traces" .. lines
var presets = {};
var plots = {}; // Index that keeps a link tracekey => plot

function getDateString(timestamp) {
  return new Date(timestamp);
}

/**
 * Initialize a Trace
 */
function createTrace(stream, type, initTime) {
  var traceKey = stream.id + '_' + type;
  var extraType = pryv.eventTypes.extras(type);
  var titleY = extraType.symbol ? extraType.symbol : type;

  if (presets[traceKey] && presets[traceKey].titleY) {
    titleY = presets[traceKey].titleY;
  }

  traces[traceKey] = {
    plotKey: traceKey,
    type: type,
    streamId: stream.id + ' ' + titleY,
    last: initTime,
    gaps: null,
    trace: {},
    yaxis : {
      yaxis1: {
        title : titleY,
        showticklabels : true,
        side: 'right'
      }
    }
  };

  if (presets[traceKey]) {
    _.extend(traces[traceKey], presets[traceKey]);
  }

  traces[traceKey].trace.x = [];
  traces[traceKey].trace.y = [];

  //--- Assign Trace to A plot or create new plot

  //-- does the desired plot exist ?
  if (! plots[traces[traceKey].plotKey]) {  // no create Plot
    var title = '';

    if (presets[traceKey] && presets[traceKey].plotKey) {
      // name per plotKey
      title = presets[traceKey].plotKey;
    } else { // take stream path
      stream.ancestors.forEach(function (ancestor) {
        title += ancestor.name + '/';
      });
      title += stream.name;
    }
    plots[traces[traceKey].plotKey] = {
      layout : { title : title }
    };
  }

  // add trace xAxis
  plots[traces[traceKey].plotKey].layout.xaxis = {
    rangeselector: selectorOptions,
    title: 'Time',
    type: 'date',
    showticklabels : true
  };

  // ADD Yaxis
  // if first plot
  if (! plots[traces[traceKey].plotKey].num) { // first plot
    plots[traces[traceKey].plotKey].num = 1;
    traces[traceKey].layout = {
      yaxis1: {
        title : titleY,
        showticklabels : true,
        side: 'left'
      }
    };

  } else {  // if not first plot
    var num = ++plots[traces[traceKey].plotKey].num;
    var pos = 1 - + ((num - 2) * 0.05);
    traces[traceKey].layout = {};
    traces[traceKey].layout['yaxis' + num] = {
      title : titleY,
      showticklabels : true,
      side: 'right',
      overlaying: 'y',
      position: pos
    };
    traces[traceKey].trace.yaxis = 'y' + num;
  }
}

var initializedTraces = {};
var initializedPlots = {};

var lastLastX = 0;
var gap = 1 * 30 * 1000;

function initOrRedraw(traceKey) {

  var trace = traces[traceKey];
  if (initializedTraces[traceKey]) {
    if (liveRange && (lastX  > (lastLastX + gap))) {
      var start = lastX - liveRange * 60 * 1000;
      var stop = lastX + 1 * 30 * 1000;
      lastLastX = lastX;
      setAllRanges(getDateString(start), getDateString(stop));
      previousWasLiverange = true;
    }

    return Plotly.redraw(trace.plotKey);
  }
  initializedTraces[traceKey] = true;

  if (! initializedPlots[trace.plotKey]) {
    initializedPlots[trace.plotKey] = true;
    var plot = document.createElement('div');
    plot.setAttribute('id', trace.plotKey);
    container.appendChild(plot);

    Plotly.newPlot(trace.plotKey, [], plots[trace.plotKey].layout);
  }

  Plotly.relayout(trace.plotKey, trace.layout);
  Plotly.addTraces(trace.plotKey, [trace.trace]);
}


/**
 * retrieve the registerURL from URL parameters
 */
function getLiveRangeURL() {
  return pryv.utility.urls.parseClientURL().parseQuery()['liverange'];
}


var lastX = 0;
var liveRange = getLiveRangeURL() || 0;



var ignoreFrom = 0; // ((new Date().getTime())) - (60 * 60 * 24 * 1000 * 10);

function updatePlot(events) {
  // Needed ?
  events = events.sort(function (a, b) {
    return a.time - b.time;
  });

  var toRedraw = {};

  events.map(function (event) {
    // Ignore trashed events and out of timer
    if (event.trashed || (ignoreFrom > event.timeLT)) {
      return;
    }


    var type = event.type;
    var isHF = false;
    if (event.type.startsWith('series:')) {
      type = event.type.substr(7);
      console.log("Z1", type);
      isHF = true;
    }


    var traceKey = event.streamId + '_' + type;

    // create trace if not exists
    if (! traces[traceKey]) {
      if (! pryv.eventTypes.isNumerical(type)) {   // ignore future event of this type
        traces[traceKey] = {ignore: true};
        return;
      }

      createTrace(event.stream, type, event.time);
    }


    if (traces[traceKey].ignore) {
      return;
    }



    if (! isHF) { // Standard event
      if (traces[traceKey].gaps) {
        if ((event.time - traces[traceKey].last) > traces[traceKey].gaps * 1000) {
          traces[traceKey].trace.x.push(getDateString(traces[traceKey].last + 1));
          traces[traceKey].trace.y.push(null);
        }
      }


      addValueToTrace(traceKey, event.time, event.timeLT, event.content);
      toRedraw[traceKey] = true;

    } else { // HF event

      if (! traces[traceKey].activeHF ||
         (traces[traceKey].activeHF.time < event.time)) {
        // new activeHF event
        traces[traceKey].activeHF = event;

        if (! traces[traceKey].pull) {
          traces[traceKey].pull = function () {
            console.log("pulling serie on", traces[traceKey].activeHF.id);
            fetchSerie(traces[traceKey].activeHF, traces[traceKey].last, function (err, res) {


              if (res.points && res.points.length > 0) {
                var l = res.points.length;
                for (var i = 0; i < l; i++) {
                  var timeLT = traces[traceKey].activeHF.connection.getLocalTime(res.points[i][0]);
                  addValueToTrace(traceKey, res.points[i][0], timeLT, res.points[i][1]);



                }



                console.log("received" + res.points.length);

              }

              initOrRedraw(traceKey);
              setTimeout(traces[traceKey].pull, pullSerieFrequencyMs);
            });





          };

          traces[traceKey].pull();
        }

      }
    }



  });

  Object.keys(toRedraw).forEach(function (traceKey) {
    initOrRedraw(traceKey);
  });
}

/**
* Add a value to a trace IF after last one
*/
function addValueToTrace(traceKey, time, timeLT, value) {


  if (! traces[traceKey].last || traces[traceKey].last < time) {

    if (timeLT > lastX) {
      lastX = timeLT;
    }

    console.log(time - traces[traceKey].last, value, getDateString(timeLT));
    traces[traceKey].trace.x.push(getDateString(timeLT));
    traces[traceKey].trace.y.push(value);
    traces[traceKey].last = time;


  } else {
    console.log('Skiping point in past for trace:' + traceKey + ' ' + getDateString(timeLT ));
  }
}

function fetchSerie(event, fromTime, done) {
  event.connection.request({
    withoutCredentials: true,
    method: 'GET',
    path: '/events/' + event.id + '/series?fromTime=' + (fromTime + 0.0001),
    callback: done});
}



function setAllForRealTime () {
  var now = new Date().getTime();
  var start = now - 5 * 60 * 1000;
  var stop = now + 5 * 60 * 1000;
  setAllRanges(getDateString(start), getDateString(stop));
}

function setAllRanges(start, stop) {
  Object.keys(plots).forEach(function (plotKey) {
    Plotly.relayout(plotKey, {xaxis: {range : [start, stop]}});
  });
}


function resetPlots() {
  if (monitor) {
    monitor.destroy();
  }
}


// *** Plotly designs ***  //
var selectorOptions = {
  buttons: [
    {
      step: 'hour',
      stepmode: 'backward',
      count: 1,
      label: '1h'
    }, {
      step: 'day',
      stepmode: 'backward',
      count: 1,
      label: '1d'
    }, {
    step: 'month',
      stepmode: 'backward',
      count: 1,
      label: '1m'
     }, {
    step: 'month',
    stepmode: 'backward',
    count: 6,
    label: '6m'
  }, {
    step: 'year',
    stepmode: 'backward',
    count: 1,
    label: '1y'
  }, {
    step: 'all'
  }]
};
