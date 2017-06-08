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
- `trace`: Plotly trace property,see: [https://plot.ly/javascript-graphing-library/reference/#scatter](https://plot.ly/javascript-graphing-library/reference/#scatter)
for reference.`

Example:

``
"clientData": {
    "app-web-plotly": {
      "count/generic": {
        "plotKey": "Multiple",
        "titleY": "Z dimension"
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