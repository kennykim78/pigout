import React from 'react';
import './ImageSourceModal.scss';

interface ImageSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCamera: () => void;
  onSelectGallery: () => void;
}

const ImageSourceModal: React.FC<ImageSourceModalProps> = ({
  isOpen,
  onClose,
  onSelectCamera,
  onSelectGallery,
}) => {
  if (!isOpen) return null;

  return (
    <div className="image-source-modal" onClick={onClose}>
      <div className="image-source-modal__content" onClick={(e) => e.stopPropagation()}>
        <h3 className="image-source-modal__title">사진 선택</h3>
        <div className="image-source-modal__buttons">
          <button 
            className="image-source-modal__button"
            onClick={onSelectCamera}
          >
            <span className="material-symbols-rounded">photo_camera</span>
            <span>카메라로 촬영</span>
          </button>
          <button 
            className="image-source-modal__button"
            onClick={onSelectGallery}
          >
            <span className="material-symbols-rounded">photo_library</span>
            <span>갤러리에서 선택</span>
          </button>
        </div>
        <button 
          className="image-source-modal__cancel"
          onClick={onClose}
        >
          취소
        </button>
      </div>
    </div>
  );
};

export default ImageSourceModal;
