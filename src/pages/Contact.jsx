import './Contact.scss';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

const Contact = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    // TODO: 백엔드로 문의 전송
    alert('문의가 접수되었습니다. 빠른 시일 내에 답변드리겠습니다.');
    navigate(-1);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="contact">
      <div className="contact__header">
        <button className="contact__back-button" onClick={() => navigate(-1)}>
          ←
        </button>
        <h1 className="contact__title">Contact Us</h1>
        <div style={{ width: '40px' }}></div>
      </div>

      <div className="contact__content">
        <div className="contact__intro">
          <h2>문의하기</h2>
          <p>궁금한 점이나 제안사항을 남겨주세요!</p>
        </div>

        <form className="contact__form" onSubmit={handleSubmit}>
          <div className="contact__form-group">
            <label htmlFor="name">이름</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="이름을 입력하세요"
              required
            />
          </div>

          <div className="contact__form-group">
            <label htmlFor="email">이메일</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="email@example.com"
              required
            />
          </div>

          <div className="contact__form-group">
            <label htmlFor="message">문의 내용</label>
            <textarea
              id="message"
              name="message"
              value={formData.message}
              onChange={handleChange}
              placeholder="문의 내용을 입력하세요"
              rows="6"
              required
            />
          </div>

          <button type="submit" className="contact__submit-button">
            전송하기
          </button>
        </form>

        <div className="contact__info">
          <h3>기타 연락처</h3>
          <div className="contact__info-item">
            <span>📧</span>
            <span>support@pigout.com</span>
          </div>
          <div className="contact__info-item">
            <span>📞</span>
            <span>02-1234-5678</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;
