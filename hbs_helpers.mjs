import Handlebars from 'handlebars';

Handlebars.registerHelper('equals', function (arg1, arg2, options) {
    return arg1.equals(arg2) ? options.fn(this) : options.inverse(this);
});