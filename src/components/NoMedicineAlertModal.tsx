import React from 'react';
import './NoMedicineAlertModal.scss';
import imgWorry from '../assets/images/img_worry.png';

interface NoMedicineAlertModalProps {
  isOpen: boolean;
  onStartAnalysis: () => void;
  onRegisterMedicine: () => void;
}

const NoMedicineAlertModal: React.FC<NoMedicineAlertModalProps> = ({
  isOpen,
  onStartAnalysis,
  onRegisterMedicine,
}) => {
  if (!isOpen) return null;

  return (
    <div className="no-medicine-alert-modal">
      <div className="no-medicine-alert-modal__overlay" />
      <div className="no-medicine-alert-modal__content">
        <img 
          src={imgWorry} 
          alt="걱정하는 돼지" 
          className="no-medicine-alert-modal__image" 
        />
        <p className="no-medicine-alert-modal__message">
          현재 저장된 복용중인 약이 없습니다.<br />
          복용중인 약 정보없이<br />
          분석을 시작하시겠습니까?
        </p>
        <div className="no-medicine-alert-modal__buttons">
          <button 
            className="no-medicine-alert-modal__button no-medicine-alert-modal__button--register"
            onClick={onRegisterMedicine}
          >
            약등록
          </button>
          <button 
            className="no-medicine-alert-modal__button no-medicine-alert-modal__button--start"
            onClick={onStartAnalysis}
          >
            분석시작
          </button>
        </div>
      </div>
    </div>
  );
};

export default NoMedicineAlertModal;
