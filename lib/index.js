/**
 * Dependencies
 */
var isundefined = require('lodash.isundefined');
var is = require('is');
var match = require('multimatch');
var path = require('path');
var pickby = require('lodash.pickby');
var slash = require('slash');
var sm = require('sitemap');

/**
 * Export plugin
 */
module.exports = plugin;

/**
 * Metalsmith plugin for generating a sitemap.
 *
 * @param {String or Object} options
 *   @property {Date} lastmod (optional)
 *   @property {String} changefreq (optional)
 *   @property {Boolean} omitExtension (optional)
 *   @property {Boolean} omitIndex (optional)
 *   @property {String} hostname
 *   @property {String} output (optional)
 *   @property {String} pattern (optional)
 *   @property {String} priority (optional)
 * @return {Function}
 */
function plugin(opts){
  /**
   * Init
   */
  opts = opts || {};

  // Accept string option to specify the hostname
  if (typeof opts === 'string') {
    opts = { hostname: opts };
  }

  // A hostname should be specified
  if (!opts.hostname) {
    throw new Error('"hostname" option required');
  }

  // Map options to local variables and set defaults
  var changefreq = opts.changefreq || 'weekly';
  var hostname = opts.hostname;
  var lastmod = opts.lastmod;
  var omitExtension = opts.omitExtension;
  var omitIndex = opts.omitIndex;
  var output = opts.output || 'sitemap.xml';
  var pattern = opts.pattern || '**/*.html';
  var priority = isNaN(opts.priority) ? 0.5 : opts.priority; // priority might be 0.0 which evaluates to false

  var chompRight = function(input, suffix) {
      if (input.endsWith(suffix)) {
        return input.slice(0, input.length - suffix.length);
      } else {
        return input;
      }
    };

  /**
   * Main plugin function
   */
  return function(files, metalsmith, done) {
    // Create sitemap object
    var sitemap = sm.createSitemap ({
      hostname: hostname
    });

    // Checks whether files should be processed
    function check(file, frontmatter) {
      // Only process files that match the pattern
      if (!match(file, pattern)[0]) {
        return false;
      }

      // Don't process private files
      if (frontmatter.private) {
        return false;
      }

      return true;
    }

    // Builds a url
    function buildUrl(file, frontmatter) {
      // Convert any windows backslash paths to slash paths
      var normalizedFile = slash(file);

      // Frontmatter settings take precedence
      if (is.string(frontmatter.canonical)) {
        return frontmatter.canonical;
      }

      // Remove index.html if necessary
      if (omitIndex && path.basename(normalizedFile) === 'index.html') {
        return chompRight(normalizedFile, 'index.html');
      }

      // Remove extension if necessary
      if (omitExtension) {
        return chompRight(normalizedFile,path.extname(normalizedFile));
      }

      // Otherwise just use the normalized 'file' entry
      return normalizedFile;
    }

    Object.keys(files).forEach(function(file) {
      // Get the current file's frontmatter
      var frontmatter = files[file];

      // Only process files that pass the check
      if (!check(file, frontmatter)) {
        return;
      }

      // Create the sitemap entry (reject keys with falsy values)
      var entry = pickby({
        changefreq: frontmatter.changefreq || changefreq,
        priority: frontmatter.priority || priority,
        lastmod: frontmatter.lastmod || lastmod
      }, function(item) { return !isundefined(item); });
      
      if('lastmod' in entry) {
        entry.lastmod = new Date(entry.lastmod).toUTCString();
      }

      console.log(entry);

      // Add the url (which is allowed to be falsy)
      entry.url = buildUrl(file, frontmatter);

      // Add the entry to the sitemap
      sitemap.add(entry);
    });

    // Create sitemap in files
    files[output] = {
      contents: new Buffer(sitemap.toString())
    };

    done();
  };
}
