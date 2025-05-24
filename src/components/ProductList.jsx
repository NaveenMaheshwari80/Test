import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { logger, logHelpers } from '../utils/logger';
import { httpRequestDurationMicroseconds, httpRequestTotal, sendMetrics, checkServerHealth } from '../utils/metrics';

function ProductList() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const sendMetricsWithCheck = async () => {
    try {
      const isHealthy = await checkServerHealth();
      if (isHealthy) {
        await sendMetrics();
      } else {
        console.warn('Metrics server is not healthy, skipping metrics');
      }
    } catch (error) {
      console.warn('Error checking server health:', error);
    }
  };

  useEffect(() => {
    const fetchProducts = async () => {
      const startTime = Date.now();
      try {
        const response = await axios.get('https://fakestoreapi.com/products');
        setProducts(response.data);
        setLoading(false);
        
        // Record metrics
        const duration = (Date.now() - startTime) / 1000;
        httpRequestDurationMicroseconds
          .labels('GET', '/products', response.status)
          .observe(duration);
        httpRequestTotal
          .labels('GET', '/products', response.status)
          .inc();
        
        // Send metrics to server
        await sendMetricsWithCheck();
        
        // Log success
        logger.info('Successfully fetched products', {
          duration,
          status: response.status,
          productCount: response.data.length,
          userAgent: navigator.userAgent
        });
      } catch (err) {
        setError(err.message);
        setLoading(false);
        
        // Record error metrics
        const duration = (Date.now() - startTime) / 1000;
        httpRequestDurationMicroseconds
          .labels('GET', '/products', 500)
          .observe(duration);
        httpRequestTotal
          .labels('GET', '/products', 500)
          .inc();
        
        // Send metrics to server
        await sendMetricsWithCheck();
        
        // Log error
        logHelpers.logError(err, {
          duration,
          userAgent: navigator.userAgent
        });
      }
    };

    fetchProducts();
  }, []);

  if (loading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="product-list">
      <h1>FakeStore Products</h1>
      <div className="card">
        {products.map(product => (
          <Link to={`/product/${product.id}`} key={product.id} className="product-link">
            <div className="product">
              <div className="product-image">
                <img src={product.image} alt={product.title} />
              </div>
              <div className="product-details">
                <h2>{product.title}</h2>
                <p className="price">${product.price}</p>
                <p className="category">{product.category}</p>
                <div className="rating">
                  <span>Rating: {product.rating.rate}/5</span>
                  <span>({product.rating.count} reviews)</span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default ProductList; 