Logger plus
===========

A simple JavaScript library to add optional functionality directly to `console.log`, avoiding the need to refactor existing code.

**Features** - Can be switched on and off

* Automatic date/time tagging of log messages, with custom date/time format.
* Ability to add tags to messages coming from particular functions (including child calls).
* Extensible with custom transformations run on messages before they are logged.
* Makes changes directly to `console.log`, so no refactoring required for existing code.
* Node.js and vanilla JavaScript.

## Installation

    npm install loggerplus --save

## Usage
_**Note:** Whilst the features are automatically applied through `console.log`, you'll still need to use some other functions and variables to activate and configure said features._

### Setup
**Node.js**

    var loggerplus = require("loggerplus");

**Vanilla JavaScript**
None - Just use `window.loggerplus`!

### Logging messages

    console.log("Hello World!");

That's it! One of the awesome things about loggerplus is that you can add it to existing code and simply configure it; no refactoring required.

### Configuring features
Simply use the `loggerplus.settings` object to turn features on and off.
Features are **off** by default.

#### Automatic date/time tagging

**Turn on feature**

    loggerplus.settings.useDateTime = true;

**Set date/time format**

    loggerplus.settings.dateTimeFormat = "[YYYY-MM-DD, HH:mm:SS.sss]"; //The default date/time format

**Date/time format legend**

* `Y` - Year
* `M` - Month
* `D` - Day
* `H` - Hour
* `m` - Minute
* `S` - Second
* `s` - Millisecond

The number fills from right to left, padding with 0's if necessary.
**E.g.** (in the year 2016)
  `YY`    `16`
  `YYY`   `016`
  `YYYY`  `2016`
  `YYYYY` `02016`
  
Note the '0 padding' in the last line.

**Note** - You can put any other character in the format string and it will remain constant, but escape sequences for the above characters have not been implemented yet (look out for future updates).

#### Custom tags
**Tag types**

* Global - Appears in every logged message.
* Local - Appears only in logs within the scope of the function to which it is applied.
* Persistent - Appears in logs within the scope of the function to which it is applied, **as well as** any any child (and child-child, child-child-child, etc.) function calls contained within it.

**Turn on feature**

    loggerplus.settings.useTags = true;
    
**Create Global Tag**

    loggerplus.tags.createGlobal("Tag");

**Create Local Tag**

    loggerplus.tags.createLocal("Tag", function_name);
    
**Create Persistent Tag**

    loggerplus.tags.createPersistent("Tag", function_name);
    
**Remove Global Tag**

    loggerplus.tags.deleteGlobal("Tag", function_name);

**Remove Local Tag**

    loggerplus.tags.deleteLocal("Tag", function_name);
    
**Remove Persistent Tag**

    loggerplus.tags.deletePersistent("Tag", function_name);
    
**Remove All Global Tags**

    loggerplus.tags.clearGlobal();

**Remove All Local Tags** (from a function)

    loggerplus.tags.clearLocal(function_name);
    
**Remove All Persistent Tags** (from a function)

    loggerplus.tags.clearPersistent(function_name);
    
#### Custom transformations
**Transformation types**

* Global - Applies to every logged message.
* Local - Applies only to logs within the scope of the function to which it is registered.
* Persistent - Applies to logs within the scope of the function to which it is registered, **as well as** any any child (and child-child, child-child-child, etc.) function calls contained within it.

**The Transformation Function**
The custom transformation function should take a single String parameter and return the modified String.

Transformations will be applied last, so the string that the function takes will contain the relevant tags (including date/time), allowing you to make changes if need be.

*For example*

    //Transform console output into upper case.
    function transformer(input) {
        return input.toUpperCase();
    }

**Note:** Whilst transformations will currently be applied in the order that they are created, I can't guarantee this to be the case in future updates. If you need to specify an order, I recommend you register a single transformation function which calls the others in order.

**Turn on feature**

    loggerplus.settings.useTransformations = true;
    
**Create Global Transformation**

    loggerplus.transformation.createGlobal("Transformation");

**Create Local Transformation**

    loggerplus.transformation.createLocal("Transformation", function_name);
    
**Create Persistent Transformation**

    loggerplus.transformation.createPersistent("Transformation", function_name);
    
**Remove Global Transformation**

    loggerplus.transformation.deleteGlobal("Transformation", function_name);

**Remove Local Transformation**

    loggerplus.transformation.deleteLocal("Transformation", function_name);
    
**Remove Persistent Transformation**

    loggerplus.transformation.deletePersistent("Transformation", function_name);
    
**Remove All Global Transformations**

    loggerplus.transformation.clearGlobal();

**Remove All Local Transformations** (from a function)

    loggerplus.transformation.clearLocal(function_name);
    
**Remove All Persistent Transformations** (from a function)

    loggerplus.transformation.clearPersistent(function_name);