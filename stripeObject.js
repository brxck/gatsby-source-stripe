var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

const stripeObjects = require('./stripeObjects');
const crypto = require('crypto');
const { createRemoteFileNode } = require(`gatsby-source-filesystem`);

module.exports = {
  init(object) {
    const filteredArray = stripeObjects.objects.filter(stripeObject => stripeObject.name === object);
    const stripeObject = filteredArray[0];

    this.name = stripeObject.name;
    this.methodName = stripeObject.methodName;
    this.methodArgs = stripeObject.methodArgs;
    this.data = stripeObject.data;
    this.dataType = stripeObject.dataType;
    this.nodeBlueprint = stripeObject.node;
    this.nodes = [];
  },

  async getApiObject(stripe) {
    const apiObject = await stripe[this.name][this.methodName](this.methodArgs);
    return apiObject;
  },

  async paginateData(stripe, apiObject) {

    // No data so don't need to paginate
    if (!apiObject.data.length) {
      return apiObject;
    }

    let hasMore = apiObject.has_more;

    // If apiObject doesn't have more, don't need
    // to paginate
    if (!hasMore) {
      return apiObject;
    }

    // Need to paginate the apiObject data
    let lastDataItemId = apiObject.data[apiObject.data.length - 1].id;
    let args = _extends({}, this.methodArgs, {
      starting_after: lastDataItemId
    });

    // Paginate through as many objects as needed in order to
    // get all of the data.
    while (hasMore) {
      const nextObject = await stripe[this.name][this.methodName](args);
      apiObject.data.push(...nextObject.data);

      lastDataItemId = nextObject.data[nextObject.data.length - 1].id;
      args = _extends({}, this.methodArgs, {
        starting_after: lastDataItemId
      });

      hasMore = nextObject.has_more;
    }

    return apiObject;
  },

  buildNodes(store, cache, createNode, createNodeId) {
    let nodes = [];
    if (this.data.data.length) {
      nodes = this.data.data.map(item => this.buildNode(item, store, cache, createNode, createNodeId));
    }

    this.nodes = nodes;
  },

  buildNode(item, store, cache, createNode, createNodeId) {
    let fileNode;
    if (item.object === 'sku' && item.product.images.length > 0) {
      item.localImages___NODE = [];

      item.product.images.forEach(async url => {
        fileNode = await createRemoteFileNode({
          url,
          store,
          cache,
          createNode,
          createNodeId
        });
        // Add reference to fileNodes
        if (fileNode) {
          item.localImages___NODE.push(fileNode.id);
        }
      });
    }

    const nodeContent = JSON.stringify(item);
    const nodeContentDigest = crypto.createHash('md5').update(nodeContent).digest('hex');

    const node = Object.assign(item, this.nodeBlueprint);

    node.internal.content = nodeContent;
    node.internal.contentDigest = nodeContentDigest;

    return node;
  }
};