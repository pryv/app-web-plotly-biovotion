# app-web-plotly

Basic webapp that allows to visualize Pryv data in real time using the Plotly graph library.

This app loads (via Pryv monitors) any [numerical type](https://api.pryv.com/event-types/#numerical-types) Pryv data and plots it in a separate graph per stream/data-type.

The app is accessible at the following URL: [https://pryv.github.io/app-web-plotly/](https://pryv.github.io/app-web-plotly/)

### Display parameters

plotly display properties can be passed at a Stream level with the property `clientData`

**properties of `app-web-plotly`**
You can specifiy per-eventType trace properties. All fields are optionals.


- `plotKey`: Traces with the same plotKey will be drawn on the same graph.
- `titleY`: Specify the title of Y axis.
- `ignore`: true | false to ignore the display of this graph
- `trace`: Plotly trace property,see: [https://plot.ly/javascript-graphing-library/reference/#scatter](https://plot.ly/javascript-graphing-library/reference/#scatter)
for reference.`

Example:

```
"clientData": {
    "app-web-plotly": {
      "count/generic": {
        "plotKey": "Multiple",
        "titleY": "Z dimension"
        "ignore": false,
        "trace": {
          "type": "scatter",
          "name": "Z",
          "mode": "lines",
          "connectgaps": 0
        }
      }
    }
  }
}
```

## `series:\*/*` Events processing

This version includes feature to use the preview of High-Frequency implementation on Pryv.

This feature can be tested with: 

- [A Mouse tracker to generate events](https://perki.github.io/pryv-app-web-hfdemo/generator/index.html?pryv-reg=reg.preview.pryv.tech)  


Series events have been implemented as:

- being happend to same "Stream" than standard events of the same type. Exemple: events of type "series:count/generic" on streamId "sampleStream" will be drawn on than events of type "count/generic" on the same stream.
- By order Each event found will be processed, but only the last (with the higher event.time value will be monitored)
- Monitoring is done by pulling on the API every `pullSerieFrequencyMs` ms 

Todo: 

- Eventually display differently Series event (maybe as "marks")
- Make sure that all series events' measures previous to the last one are fetched. (not done now)

## Support and warranty

Pryv provides this software for educational and demonstration purposes with no support or warranty.
