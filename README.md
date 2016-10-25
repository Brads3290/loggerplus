Logger plus
===========

A simple JavaScript library to add optional functionality directly to `console.log`, avoiding the need to refactor existing code.

##Features

* Automatic date/time tagging of log messages, with custom date/time format.
* Ability to add tags to messages coming from particular functions (including child calls).
* Extensible with custom transformations run on messages and objects before they are logged.
* Makes changes directly to `console.log`, so no refactoring required for existing code.
* Supports variations of `console.log` - namely `error` and `warn` for now.
* Works with multiple arguments to the log functions (used in the same way as vanilla `console.log` - [see here](https://developer.mozilla.org/en-US/docs/Web/API/Console/log))
* Node.js and vanilla JavaScript.

## Installation

    npm install loggerplus --save

## Usage
_**Note:** Whilst the features are automatically applied through `console.log`, you'll still need to use some other functions and variables to activate and configure said features._

### Setup
#### Node.js

    var loggerplus = require("loggerplus");

#### Vanilla JavaScript  
None - Just use `window.loggerplus`!

### Settings
Loggerplus stores its settings in `loggerplus.settings`.  
**\[Type\]** (default value) `key`: _Description_

* **\[String\]** (\[YYYY-MM-DD, HH:mm:SS.sss\]) `dateTimeFormat`: _Sets the format of the date/time output (see date/time tagging)._
* **\[Boolean\]** (false) `useDateTime`: _Turns on or off date/time tagging._
* **\[Boolean\]** (false) `useTags`: _Turns on or off custom tagging._
* **\[Boolean\]** (false) `useTextTransformations`: _Turns on or off custom transformations for text components of the log._
* **\[Boolean\]** (false) `useObjectTransformations`: _Turns on or off custom transformations for object components of the log._
* **\[Boolean\]** (true) `transformTags`: _Apply text transformations to tags as well as logged text._
* **\[Boolean\]** (false) `disableLogging`: _Disables console logging (for production code)._
* **\[Boolean\]** (true) `useMicroTemplates`: _Use [tinytim](https://www.npmjs.com/package/tinytim) and [stacktrace-js](https://www.npmjs.com/package/stacktrace-js) to provide dynamic logging content._

### Logging messages

    console.log("Hello World!");

That's it! One of the awesome things about loggerplus is that you can add it to existing code and simply configure it; no refactoring required.

**What if I want to use the native `console.log` somewhere in my code?**  
Easy! Simply use `console.native_log(message);`

**Note:** Loggerplus also works with the following `console.log` variants (as well as defining their `console.native_` equivalents)

* `console.warn`
* `console.error`

### Configuring features
Simply use the `loggerplus.settings` object to turn features on and off.  
Features are **off** by default.

##### Feature types

* Global - Appears in every logged message.
* Local - Appears only in logs within the scope of the function to which it is applied.
* Persistent - Appears in logs within the scope of the function to which it is applied, **as well as** any any child (and child-child, child-child-child, etc.) function calls contained within it.

#### Automatic date/time tagging
**Must be activated with `useDateTime`**

##### Set date/time format

    loggerplus.settings.dateTimeFormat = "[YYYY-MM-DD, HH:mm:SS.sss]"; //The default date/time format

##### Date/time format legend

* `Y` - Year
* `M` - Month
* `D` - Day
* `H` - Hour
* `m` - Minute
* `S` - Second
* `s` - Millisecond

The number fills from right to left, padding with 0's if necessary.
**E.g.** (in the year 2016)

* `YY` = `16`
* `YYY` = `016`
* `YYYY` = `2016`
* `YYYYY` = `02016`
  
Note the '0 padding' in the last line.

**Note** - You can put any other character in the format string and it will remain constant, but escape sequences for the above characters have not been implemented yet (look out for future updates).

#### Custom tags
**Must be activated with `useTags`**
    
##### Create Global Tag

    loggerplus.tags.createGlobal("Tag");

##### Create Local Tag

    loggerplus.tags.createLocal("Tag", function_name);
    
##### Create Persistent Tag

    loggerplus.tags.createPersistent("Tag", function_name);
    
##### Remove Global Tag

    loggerplus.tags.deleteGlobal("Tag");

##### Remove Local Tag

    loggerplus.tags.deleteLocal("Tag", function_name);
    
##### Remove Persistent Tag

    loggerplus.tags.deletePersistent("Tag", function_name);
    
##### Remove All Global Tags

    loggerplus.tags.clearGlobal();

##### Remove All Local Tags (from a function)

    loggerplus.tags.clearLocal(function_name);
    
##### Remove All Persistent Tags (from a function)

    loggerplus.tags.clearPersistent(function_name);
    
#### Custom transformations
**Must be activated with `useObjectTransformations` or `useTextTransformations`**  

**Legend:**

* _transformer:_ The transformation function.
* _function_name:_ The function relative to which the transformation will be applied.

##### The Transformation Function  
The custom transformation function should take a single String parameter and return the modified String.

Transformations will be applied last, so the string that the function takes will contain the relevant tags (including date/time), allowing you to make changes if need be.

*For example*

    //Transform text console output into upper case.
    function text_transformer(input) {
        return input.toUpperCase();
    }
    
    //Add a property to output objects.
    function object_transformer(input) {
        input.consoleOutput = true;
        
        return input;
    }

**Note:** Whilst transformations will currently be applied in the order that they are created, I can't guarantee this to be the case in future updates. If you need to specify an order, I recommend you register a single transformation function which calls the others in order.  

**Also:** You do **NOT** need to deep copy objects when modifying them to avoid breaking things. Loggerplus handles the copying of objects for you.
##### Create Global Transformation

    loggerplus.transformation.createGlobalText(text_transformer)
    loggerplus.transformation.createGlobalObject(object_transformer)

##### Create Local Transformation

    loggerplus.transformation.createLocalText(text_transformer, function_name)
    loggerplus.transformation.createLocalObject(object_transformer, function_name)
    
##### Create Persistent Transformation

    loggerplus.transformation.createPersistentText(text_transformer, function_name)
    loggerplus.transformation.createPersistentObject(object_transformer, function_name)
    
##### Remove Global Transformation

    loggerplus.transformation.deleteGlobalText(text_transformer, function_name)
    loggerplus.transformation.deleteGlobalObject(object_transformer, function_name)

##### Remove Local Transformation

    loggerplus.transformation.deleteLocalText(text_transformer, function_name)
    loggerplus.transformation.deleteLocalObject(object_transformer, function_name)
    
##### Remove Persistent Transformation

    loggerplus.transformation.deletePersistentText(text_transformer, function_name)
    loggerplus.transformation.deletePersistentObject(object_transformer, function_name)
    
##### Remove All Global Transformations

    loggerplus.transformation.clearGlobalText()
    loggerplus.transformation.clearGlobalObject()

##### Remove All Local Transformations (from a function)

    loggerplus.transformation.clearLocalText(function_name)
    loggerplus.transformation.clearLocalObject(function_name)
    
##### Remove All Persistent Transformations (from a function)

    loggerplus.transformation.clearPersistentText(function_name)
    loggerplus.transformation.clearPersistentObject(function_name)