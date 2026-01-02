import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  getActivityHistory,
  createPost,
  createGeneralPost,
  updatePost,
} from "../services/api";
import "./PigLoungeWrite.scss";

const PigLoungeWrite = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef(null);

  // 수정 모드 체크
  const editMode = location.state?.editMode || false;
  const editPost = location.state?.post || null;

  // 피드 타입: 'food' | 'general'
  const [postType, setPostType] = useState(
    editPost?.post_type || editPost?.postType || "food"
  );

  // 음식 피드 관련
  const [history, setHistory] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [loading, setLoading] = useState(true);

  // 공통
  const [comment, setComment] = useState(editPost?.comment || "");
  const [tags, setTags] = useState(
    editPost?.tags ? editPost.tags.join(" ") : ""
  );

  // 일반 피드 이미지
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(
    editPost?.image_url || editPost?.imageUrl || null
  );
  const [compressing, setCompressing] = useState(false);

  useEffect(() => {
    if (postType === "food") {
      loadHistory();
    } else {
      setLoading(false);
    }
  }, [postType]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const result = await getActivityHistory(10, 0);
      const foodItems =
        result?.historyList?.flatMap((day) =>
          day.items.filter((item) => item.type === "food_analysis")
        ) || [];
      setHistory(foodItems);
    } catch (error) {
      console.error("Failed to load history:", error);
    } finally {
      setLoading(false);
    }
  };

  // 이미지 압축 함수 (50KB 목표)
  const compressImage = async (file, maxSizeKB = 50) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;

          // 최대 크기 제한 (큰 이미지는 먼저 리사이징)
          const maxDimension = 800;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = (height / width) * maxDimension;
              width = maxDimension;
            } else {
              width = (width / height) * maxDimension;
              height = maxDimension;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          // 품질을 점진적으로 낮춰가며 50KB 이하가 될 때까지 시도
          let quality = 0.8;
          let result = canvas.toDataURL("image/jpeg", quality);

          while (result.length > maxSizeKB * 1024 * 1.37 && quality > 0.1) {
            quality -= 0.1;
            result = canvas.toDataURL("image/jpeg", quality);
          }

          // 여전히 크다면 추가 리사이징
          if (result.length > maxSizeKB * 1024 * 1.37) {
            const scale = 0.7;
            canvas.width = width * scale;
            canvas.height = height * scale;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            result = canvas.toDataURL("image/jpeg", 0.6);
          }

          resolve(result);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  // 이미지 선택 핸들러
  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 이미지 타입 체크
    if (!file.type.startsWith("image/")) {
      alert("이미지 파일만 업로드 가능합니다.");
      return;
    }

    setCompressing(true);
    try {
      const compressedBase64 = await compressImage(file, 50);
      setImagePreview(compressedBase64);
      setImageFile(compressedBase64);

      // 압축 결과 크기 확인
      const sizeKB = Math.round((compressedBase64.length * 0.75) / 1024);
      console.log(`이미지 압축 완료: ${sizeKB}KB`);
    } catch (error) {
      console.error("이미지 압축 실패:", error);
      alert("이미지 처리 중 오류가 발생했습니다.");
    } finally {
      setCompressing(false);
    }
  };

  // 이미지 제거
  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    // 음식 피드 유효성 검사
    if (postType === "food" && !selectedItem && !editMode) {
      alert("공유할 맛있는 기록을 선택해주세요! 🐷");
      return;
    }

    if (!comment.trim()) {
      alert("친구들에게 할 말을 적어주세요!");
      return;
    }

    const parsedTags = tags
      .split(" ")
      .filter((t) => t.startsWith("#") && t.length > 1);

    try {
      if (editMode && editPost?.id) {
        // 수정 모드
        await updatePost(editPost.id, {
          comment: comment,
          tags: parsedTags,
          imageUrl: imageFile || imagePreview,
        });
      } else if (postType === "food") {
        // 음식 피드 작성
        const postData = {
          foodName: selectedItem.name,
          score: selectedItem.score || 100,
          lifeChange: selectedItem.change || 0,
          comment: comment,
          imageUrl: selectedItem.imageUrl || "🍽️",
          tags: parsedTags,
        };
        await createPost(postData);
      } else {
        // 일반 피드 작성
        const postData = {
          comment: comment,
          imageUrl: imageFile || undefined,
          tags: parsedTags,
        };
        await createGeneralPost(postData);
      }

      navigate("/lounge");
    } catch (error) {
      console.warn("Post creation failed:", error);

      // 로컬 폴백
      const newPost = {
        id: Date.now(),
        user: "나야나",
        post_type: postType,
        comment: comment,
        tags: parsedTags,
        image_url: postType === "general" ? imageFile : undefined,
        ...(postType === "food" && selectedItem
          ? {
              food_name: selectedItem.name,
              score: selectedItem.score || 100,
              life_change: selectedItem.change || 0,
            }
          : {}),
        likes: 0,
        like_count: 0,
        comment_count: 0,
        isLiked: false,
        date: "방금 전",
        isMyPost: true,
      };

      const savedPosts = JSON.parse(
        localStorage.getItem("pigout_feed_posts") || "[]"
      );
      localStorage.setItem(
        "pigout_feed_posts",
        JSON.stringify([newPost, ...savedPosts])
      );

      navigate("/lounge");
    }
  };

  return (
    <div className="pig-lounge-write">
      <header className="write-header">
        <button className="close-btn" onClick={() => navigate(-1)}>
          <span className="material-symbols-rounded">close</span>
        </button>
        <h1>{editMode ? "수정하기" : "글 쓰기"}</h1>
        <button className="submit-btn" onClick={handleSubmit}>
          {editMode ? "완료" : "공유"}
        </button>
      </header>

      <div className="write-content">
        {/* 피드 타입 선택 (수정 모드가 아닐 때만) */}
        {!editMode && (
          <section className="type-section">
            <div className="type-toggle">
              <button
                className={`type-btn ${postType === "food" ? "active" : ""}`}
                onClick={() => setPostType("food")}
              >
                <span className="material-symbols-rounded">restaurant</span>
                음식 후기
              </button>
              <button
                className={`type-btn ${postType === "general" ? "active" : ""}`}
                onClick={() => setPostType("general")}
              >
                <span className="material-symbols-rounded">edit_note</span>
                일반 글
              </button>
            </div>
          </section>
        )}

        {/* 음식 피드: 음식 선택 */}
        {postType === "food" && !editMode && (
          <section className="selection-section">
            <h2>어떤 걸 먹었나요?</h2>
            {loading ? (
              <div className="loading-state">기록 불러오는 중...</div>
            ) : history.length > 0 ? (
              <div className="history-list">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className={`history-item ${
                      selectedItem?.id === item.id ? "selected" : ""
                    }`}
                    onClick={() => setSelectedItem(item)}
                  >
                    <div className="icon">🍽️</div>
                    <div className="info">
                      <span className="name">{item.name}</span>
                      <span className="date">
                        {new Date(item.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    {item.change && (
                      <span
                        className={`change ${item.change > 0 ? "good" : "bad"}`}
                      >
                        {item.change > 0 ? "+" : ""}
                        {item.change}일
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>최근 분석 기록이 없어요 🥲</p>
                <button onClick={() => navigate("/main")}>분석하러 가기</button>
              </div>
            )}
          </section>
        )}

        {/* 일반 피드: 이미지 업로드 */}
        {postType === "general" && (
          <section className="image-section">
            <h2>사진 첨부 (선택)</h2>
            <div className="image-upload-area">
              {imagePreview ? (
                <div className="image-preview">
                  <img src={imagePreview} alt="미리보기" />
                  <button className="remove-btn" onClick={handleRemoveImage}>
                    <span className="material-symbols-rounded">close</span>
                  </button>
                </div>
              ) : (
                <div
                  className="upload-placeholder"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {compressing ? (
                    <div className="compressing">
                      <span className="material-symbols-rounded rotating">
                        sync
                      </span>
                      <span>압축 중...</span>
                    </div>
                  ) : (
                    <>
                      <span className="material-symbols-rounded">
                        add_photo_alternate
                      </span>
                      <span>사진 추가 (자동 50KB 압축)</span>
                    </>
                  )}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                style={{ display: "none" }}
              />
            </div>
          </section>
        )}

        {/* 공통: 텍스트 입력 */}
        <section className="input-section">
          <div className="textarea-wrapper">
            <textarea
              placeholder={
                postType === "food"
                  ? "이 음식은 어땠나요? 솔직한 후기를 남겨보세요! (예: 역시 야식은 치킨이지!)"
                  : "오늘의 이야기를 들려주세요! 🐷"
              }
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 200))}
              maxLength={200}
            />
            <span
              className={`char-count ${comment.length >= 200 ? "limit" : ""}`}
            >
              {comment.length}/200
            </span>
          </div>
          <input
            type="text"
            className="tag-input"
            placeholder="태그 입력 (예: #존맛 #야식)"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
        </section>
      </div>
    </div>
  );
};

export default PigLoungeWrite;
