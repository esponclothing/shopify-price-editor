const fs = require('fs');
const path = 'src/App.jsx';
let lines = fs.readFileSync(path, 'utf8').split('\n');

const newCode = `  const fetchProducts = async () => {
    try {
      let allProducts = [];
      let hasNextPage = true;
      let cursor = null;
      let fetchedCount = 0;

      while (hasNextPage && fetchedCount < 500) {
        const query = \`
          query($cursor: String) {
            products(first: 50, sortKey: CREATED_AT, reverse: true, after: $cursor) {
              pageInfo {
                hasNextPage
                endCursor
              }
              edges {
                node {
                  id
                  title
                  vendor
                  productType
                  tags
                  handle
                  descriptionHtml
                  seo { title description }
                  resourcePublications(first: 50) { edges { node { publication { id } isPublished } } }
                  collections(first: 10) { edges { node { id title handle } } }
                  images(first: 2) { edges { node { id url } } }
                  variants(first: 50) {
                    edges {
                      node {
                        id
                        title
                        price
                        compareAtPrice
                        inventoryItem {
                          id
                          inventoryLevels(first: 10) {
                            edges {
                              node {
                                location { id }
                                quantities(names: ["available"]) { quantity }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        \`;
        const response = await axios.post('/api/shopify/graphql.json', { query, variables: { cursor } });
        if (response.data.errors) throw new Error(response.data.errors[0].message);
        
        const productsData = response.data.data.products;
        const nodes = productsData.edges.map(edge => edge.node);
        allProducts = [...allProducts, ...nodes];
        
        hasNextPage = productsData.pageInfo.hasNextPage;
        cursor = productsData.pageInfo.endCursor;
        fetchedCount += nodes.length;
      }

      setProducts(allProducts);
    } catch (err) {
      setError(err.message || 'Failed to fetch products');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };`.split('\n');

lines.splice(214, 55, ...newCode);

fs.writeFileSync(path, lines.join('\n'), 'utf8');
console.log('fetchProducts paginated exactly!');
