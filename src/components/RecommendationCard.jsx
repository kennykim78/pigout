import PropTypes from 'prop-types';
import './RecommendationCard.scss';

const RecommendationCard = ({ image, title, alt }) => {
  return (
    <div className="recommendation-card">
      <img src={image} alt={alt} className="recommendation-card__image" />
      <h3 className="recommendation-card__title">{title}</h3>
    </div>
  );
};

RecommendationCard.propTypes = {
  image: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  alt: PropTypes.string.isRequired,
};

export default RecommendationCard;
