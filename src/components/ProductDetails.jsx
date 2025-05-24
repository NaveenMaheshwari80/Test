import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { logger, logHelpers } from '../utils/logger';
import { httpRequestDurationMicroseconds, httpRequestTotal, sendMetrics, checkServerHealth } from '../utils/metrics';

function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
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
    const fetchProduct = async () => {
      const startTime = Date.now();
      try {
        const response = await axios.get(`https://fakestoreapi.com/products/${id}`);
        setProduct(response.data);
        setLoading(false);

        // Record metrics
        const duration = (Date.now() - startTime) / 1000;
        httpRequestDurationMicroseconds
          .labels('GET', `/products/${id}`, response.status)
          .observe(duration);
        httpRequestTotal
          .labels('GET', `/products/${id}`, response.status)
          .inc();

        // Send metrics to server
        await sendMetricsWithCheck();

        // Log success
        logger.info(`Successfully fetched product ${id}`, {
          duration,
          status: response.status,
          productId: id,
          userAgent: navigator.userAgent
        });
      } catch (err) {
        setError(err.message);
        setLoading(false);

        // Record error metrics
        const duration = (Date.now() - startTime) / 1000;
        httpRequestDurationMicroseconds
          .labels('GET', `/products/${id}`, 500)
          .observe(duration);
        httpRequestTotal
          .labels('GET', `/products/${id}`, 500)
          .inc();

        // Send metrics to server
        await sendMetricsWithCheck();

        // Log error
        logHelpers.logError(err, {
          productId: id,
          duration,
          userAgent: navigator.userAgent
        });
      }
    };

    fetchProduct();
  }, [id]);

  if (loading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error">Error: {error}</div>;
  if (!product) return <div className="error">Product not found</div>;

  return (
    <div className="product-detail">
      <Link to="/" className="back-button">← Back to Products</Link>
      <div className="product-detail-content">
        <div className="product-detail-image">
          <img src={product.image} alt={product.title} />
        </div>
        <div className="product-detail-info">
          <h1>{product.title}</h1>
          <p className="price">${product.price}</p>
          <p className="category">Category: {product.category}</p>
          <div className="rating">
            <span>Rating: {product.rating.rate}/5</span>
            <span>({product.rating.count} reviews)</span>
          </div>
          <p className="description">{product.description}</p>
          <button className="add-to-cart">Add to Cart</button>
        </div>
      </div>
    </div>
  );
}

export default ProductDetail; 