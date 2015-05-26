# sails-plugin

A plugin loader for sails.js. This module only works if you lift sails programaticaly.
It won't work with `sails lift` on the command line.

## Usage

```
npm install --save sails-plugin
```

Replace the lines `sails.lift` in `app.js` with these lines:

```javascript
var options = rc('sails');
options.moduleLoaderOverride = require('sails-plugin');

// Start server
sails.lift(options);
```

## TODO
See [open issues](https://github.com/pixtron/sails-plugin/labels/todo)