import {
  create,
  get,
  remove,
  update,
} from '@binaris/shift-db';

import unified from 'unified';
import parse from 'remark-parse';
import remark2rehype from 'remark-rehype';
import stringify from 'rehype-stringify';
import slug from 'rehype-slug';
import link from 'rehype-autolink-headings';
import fm from 'front-matter';

import { validateJWT } from './authBackend';

const processor = unified()
  .use(parse)
  .use(remark2rehype)
  .use(slug)
  .use(link)
  .use(stringify);

const contentKey = 'content';

// Routes must adhere to a specific format (because
// they literally are turned into URL paths). No spaces
// and only lowercase letters.
//
// Note: this is not a security check and not foolproof,
//       only for convenience.
//
function cleanRoute(someRoute) {
  return someRoute.replace(/\s+/g, '-').toLowerCase();
}

/**
 * Retrieves all content stored at the user-defined
 * "contentKey". If no content is found, an empty object
 * will be created at the "contentKey".
 */
async function getContent() {
  const storedContent = await get(contentKey);
  if (storedContent === undefined) {
    // remove first, just in case
    await remove(contentKey);
    await create(contentKey, {});
    return {};
  }
  return storedContent;
}

/**
 * Given raw markdown, this function does the following
 *
 * 1. Extract frontmatter from markdown body
 * 2. Parse remaining markdown into valid HTML
 * 3. Return all parsed data + initial raw repr
 *
 * @param { string } markdownContent - content to parse
 *
 * @return { object } - the parsed markdown, frontmatter and raw
 */
async function parseMDLocal(markdownContent) {
  const fmContent = fm(markdownContent);
  const { contents } = await processor.process(fmContent.body);
  fmContent.parsed = contents;
  return {
    ...fmContent,
    parsed: contents,
    raw: markdownContent
  };
}

/**
 * Authenticated endpoint which will convert raw markdown
 * into it's valid HTML repr. Also returns frontmatter
 * attributes extracted from the original content.
 *
 * @param { string } jwt - token used for identification
 * @param { string } markdownContent - content to parse
 *
 * @return { object } - parsed content and attributes
 */
/* @expose */
export async function parseMD(jwt, markdownContent) {
  await validateJWT(jwt);
  return parseMDLocal(markdownContent);
}

/**
 * Authenticated route which attempts to update or create a
 * post, based on the provided content. The unique key of the
 * content is based on the route attribute defined in the
 * contents frontmatter. If the content does not define a route
 * attribute, this method will fail.
 *
 * @param { string } jwt - token used for identification
 * @param { string } content - valid markdown content with fronmatter containing route
 * attribute
 * @param { string } clientPrevContent - the content state the client currently believes exists in the
 * remote
 */
/* @expose */
export async function updateContent(jwt, content, clientPrevContent = null) {
  await validateJWT(jwt);
  // parse the client provided markdown to extract
  // the route attribute
  const parsed = await parseMDLocal(content);
  const route = parsed.attributes.route;
  // for some reason returning errors out of the updater
  // seems to not work as expected
  let potentialError = undefined;
  try {
    await update(contentKey, (prevContent) => {
      const copied = { ...prevContent };
      // content must have a route
      if (route === undefined) {
        potentialError = {
          type: 'error',
          code: 'CONTENT_MISSING_FIELD',

          message: `Content: must contain "route" field in frontmatter`,
        };
        throw new Error(potentialError.message);
      }
      // routes are forced into valid shape
      const clean = cleanRoute(route);
      // this makes it hard to accidentally overwrite content
      if (clientPrevContent !== null &&
          clientPrevContent !== copied[clean].raw) {
        potentialError = {
          type: 'error',
          code: 'CONTENT_HAS_CHANGED',
          message: `Content at route: "${clean}" has been modified since reading`,
        };
        throw new Error(potentialError.message);
      }
      copied[clean] = parsed;
      return copied;
    });
  } catch (err) {
    // "err" object here is borked, need to rely on manual error
    return potentialError || {
      type: 'error',
      code: 'UNKNOWN_ERROR',
      message: err.message,
    };
  }
}

/**
 * Authenticated route which retrieves the raw markdown
 * representation of existing content.
 *
 * @param { string } jwt - token used for identification
 * @param { string } route - route of raw markdown content to retrieve
 *
 * @return { string } - raw markdown for provided route
 */
/* @expose */
export async function getContentByRoute(jwt, route) {
  await validateJWT(jwt);
  const loadedContent = await getContent();
  const contentKeys = Object.keys(loadedContent);
  for (let i = 0; i < contentKeys.length; i += 1) {
    // extract the attributes which are derived from content frontmatter
    const { attributes } = loadedContent[contentKeys[i]];
    if (cleanRoute(attributes.route) === cleanRoute(route)) {
      return loadedContent[contentKeys[i]];
    }
  }
  throw new Error(`No content found for route: "${route}"`);
}

/**
 * Load content from the backend. Case of the title does
 * not matter, as all titles are compared with lowercase.
 *
 * @param { string } title - what the content is named
 *
 * @return { string } - html representation of the content
 */
// @expose
export async function loadContentByRoute(route) {
  const loadedContent = await getContent();
  const contentKeys = Object.keys(loadedContent);
  for (let i = 0; i < contentKeys.length; i += 1) {
    // extract the attributes which are derived from content frontmatter
    const { attributes } = loadedContent[contentKeys[i]];
    if (cleanRoute(attributes.route) === cleanRoute(route)) {
      return loadedContent[contentKeys[i]].parsed;
    }
  }
  throw new Error(`No content found for route: ${route}`);
}

/**
 * Returns the metadata of all content.
 *
 * @return {object} - metadata of content
 */
// @expose
export async function getContentMeta() {
  const loaded = await getContent();
  return Object.keys(loaded).map((key) =>
    loaded[key].attributes);
}
