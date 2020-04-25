/* eslint-disable
  import/first,
  import/order,
  comma-dangle,
  linebreak-style,
  no-param-reassign,
  no-underscore-dangle,
  prefer-destructuring,
  multiline-ternary
*/
import loaderUtils from 'loader-utils';
import validateOptions from 'schema-utils';
import Terser from 'terser';
import NodeTargetPlugin from 'webpack/lib/node/NodeTargetPlugin';
import SingleEntryPlugin from 'webpack/lib/SingleEntryPlugin';
import LoaderError from './Error';
import schema from './options.json';

export default function loader() {}

export function pitch(request) {
  const options = loaderUtils.getOptions(this) || {};
  console.log(
    'Stringify Loader',
    { options },
    this.resource,
    this.resourceQuery
  );

  validateOptions(schema, options, 'Stringify Loader');

  if (!this.webpack) {
    throw new LoaderError({
      name: 'Stringify Loader',
      message: 'This loader is only usable with webpack',
    });
  }

  this.cacheable(false);

  const cb = this.async();

  const filename = loaderUtils.interpolateName(
    this,
    options.name || '[hash].stringified.js',
    {
      context: options.context || this.rootContext || this.options.context,
      regExp: options.regExp,
    }
  );

  const stringifier = {
    options: {
      filename,
      chunkFilename: `[id].${filename}`,
      namedChunkFilename: null,
    },
  };

  stringifier.compiler = this._compilation.createChildCompiler(
    'stringifier',
    stringifier.options
  );

  if (this.target !== 'webworker' && this.target !== 'web') {
    new NodeTargetPlugin().apply(stringifier.compiler);
  }

  new SingleEntryPlugin(this.context, `!!${request}`, 'main').apply(
    stringifier.compiler
  );

  const subCache = `subcache ${__dirname} ${request}`;

  stringifier.compilation = (compilation) => {
    if (compilation.cache) {
      if (!compilation.cache[subCache]) {
        compilation.cache[subCache] = {};
      }

      compilation.cache = compilation.cache[subCache];
    }
  };

  if (stringifier.compiler.hooks) {
    const plugin = { name: 'StringifyLoader' };

    stringifier.compiler.hooks.compilation.tap(plugin, stringifier.compilation);
  } else {
    stringifier.compiler.plugin('compilation', stringifier.compilation);
  }

  stringifier.compiler.runAsChild((err, entries, compilation) => {
    if (err) return cb(err);

    if (entries[0]) {
      stringifier.file = entries[0].files[0];

      const content = compilation.assets[stringifier.file].source();

      const finalContent = options.optimize
        ? Terser.minify(content).code
        : content;

      console.log(content);
      console.log(finalContent);
      return cb(null, `module.exports = ${JSON.stringify(finalContent)};`);
    }

    return cb(null, null);
  });
}
