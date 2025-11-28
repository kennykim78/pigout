import { useState } from 'react';
import './MedicineAlertModal.scss';
import imgWorry from '../assets/images/img_worry.png';

interface MedicineAlertModalProps {
  isOpen: boolean;
  onYes: () => void;
  onNo: () => void;
}

const MedicineAlertModal = ({ isOpen, onYes, onNo }: MedicineAlertModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="medicine-alert-modal">
      <div className="medicine-alert-modal__overlay" onClick={onNo} />
      <div className="medicine-alert-modal__content">
        <img 
          src={imgWorry} 
          alt="걱정하는 돼지" 
          className="medicine-alert-modal__image" 
        />
        <h2 className="medicine-alert-modal__title">
          복용중인 약도<br />알려주세요!
        </h2>
        <p className="medicine-alert-modal__description">
          복용중인 약을 알려주시면<br />
          좀 더 <strong>자세한 분석</strong>을 해드릴 수 있어요!
        </p>
        <div className="medicine-alert-modal__buttons">
          <button 
            className="medicine-alert-modal__button medicine-alert-modal__button--yes"
            onClick={onYes}
          >
            예, 알려줄게요
          </button>
          <button 
            className="medicine-alert-modal__button medicine-alert-modal__button--no"
            onClick={onNo}
          >
            나중에 할게요
          </button>
        </div>
      </div>
    </div>
  );
};

export default MedicineAlertModal;
