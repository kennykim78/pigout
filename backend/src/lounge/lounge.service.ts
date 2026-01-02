import { Injectable, HttpException, HttpStatus } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import { UsersService } from "../users/users.service";
import { containsProfanity } from "../utils/bad-words";

@Injectable()
export class LoungeService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly usersService: UsersService
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  async getFeed(
    userId: string | null,
    limit: number,
    offset: number,
    sort: string
  ) {
    let query = this.supabase
      .from("feed_posts")
      .select(
        `
        *,
        user:user_id (nickname),
        is_liked: feed_likes!left(id),
        is_bookmarked: feed_bookmarks!left(id)
      `
      )
      .eq("is_public", true)
      .range(offset, offset + limit - 1);

    // 정렬
    if (sort === "popular") {
      query = query.order("like_count", { ascending: false });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    // 좋아요/북마크 여부 확인을 위한 필터 (Left Join 활용이 Supabase JS에선 제한적이므로
    // 여기서는 전체를 가져와서 map 하거나, RPC를 쓰는게 좋음.
    // 하지만 간단하게 구현하기 위해 일단 데이터를 가져오고 메모리에서 처리하거나
    // Supabase의 relation query 기능을 활용.
    // 위 select 문법: is_liked: feed_likes(...) 는 user_id 필터가 필요함.
    // Supabase JS에서는 .eq('feed_likes.user_id', userId) 처럼 할 수 있지만,
    // Left Join 시 매칭 안되면 null이 되는데, 필터가 들어가면 Inner Join처럼 동작할 수 있음.

    // 심플한 접근: 일단 포스트 가져오고, 내가 좋아요한 포스트 ID 목록을 별도로 가져와서 매핑.

    // 1. 포스트 목록 조회
    const { data: posts, error } = await query;
    if (error)
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);

    if (!userId || posts.length === 0) {
      return posts.map((p) => ({
        ...p,
        isLiked: false,
        isBookmarked: false,
        user: p.nickname || "익명", // user join이 없거나 nickname 컬럼 직접 사용
      }));
    }

    // 2. 나의 좋아요/북마크 목록 조회
    const postIds = posts.map((p) => p.id);

    const { data: myLikes } = await this.supabase
      .from("feed_likes")
      .select("post_id")
      .eq("user_id", userId)
      .in("post_id", postIds);

    const { data: myBookmarks } = await this.supabase
      .from("feed_bookmarks")
      .select("post_id")
      .eq("user_id", userId)
      .in("post_id", postIds);

    const likedSet = new Set(myLikes?.map((l) => l.post_id));
    const bookmarkedSet = new Set(myBookmarks?.map((b) => b.post_id));

    return posts.map((p) => ({
      ...p,
      isLiked: likedSet.has(p.id),
      isBookmarked: bookmarkedSet.has(p.id),
      user: p.nickname || "익명",
    }));
  }

  async createPost(userId: string, data: any) {
    // 0. 글자수 제한 (200자)
    if (data.comment && data.comment.length > 200) {
      throw new HttpException(
        "게시글은 200자까지 작성할 수 있어요! 🐷",
        HttpStatus.BAD_REQUEST
      );
    }

    // 1. 비속어 필터링
    if (
      containsProfanity(data.comment) ||
      (data.foodName && containsProfanity(data.foodName))
    ) {
      throw new HttpException(
        "바르고 고운 말을 써주세요! 비속어가 포함되어 있습니다. 🚫",
        HttpStatus.BAD_REQUEST
      );
    }

    // 2. 도배 방지 (간단 구현: 최근 1분 내 작성글 확인)
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const { count } = await this.supabase
      .from("feed_posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", oneMinuteAgo);

    if (count && count >= 3) {
      throw new HttpException(
        "잠시만요! 너무 빨리 작성하고 계셔요. 조금 천천히 올려주세요. 🐷",
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    // 닉네임 조회
    const user = await this.usersService.findById(userId);
    const nickname = user?.nickname || "익명 돼지";

    const postData: any = {
      user_id: userId,
      nickname: nickname,
      comment: data.comment,
      image_url: data.imageUrl,
      tags: data.tags || [],
      post_type: data.postType || "food", // 'food' or 'general'
    };

    // 음식 관련 피드인 경우에만 음식 정보 추가
    if (data.foodName) {
      postData.food_name = data.foodName;
      postData.score = data.score;
      postData.life_change = data.lifeChange;
    }

    const { data: post, error } = await this.supabase
      .from("feed_posts")
      .insert(postData)
      .select()
      .single();

    if (error)
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    return post;
  }

  async toggleLike(userId: string, postId: string) {
    // 이미 좋아요 했는지 확인
    const { data: existing } = await this.supabase
      .from("feed_likes")
      .select("id")
      .eq("user_id", userId)
      .eq("post_id", postId)
      .single();

    if (existing) {
      // 취소
      await this.supabase.from("feed_likes").delete().eq("id", existing.id);
      return { liked: false };
    } else {
      // 추가
      await this.supabase
        .from("feed_likes")
        .insert({ user_id: userId, post_id: postId });
      return { liked: true };
    }
  }

  async toggleBookmark(userId: string, postId: string) {
    const { data: existing } = await this.supabase
      .from("feed_bookmarks")
      .select("id")
      .eq("user_id", userId)
      .eq("post_id", postId)
      .single();

    if (existing) {
      await this.supabase.from("feed_bookmarks").delete().eq("id", existing.id);
      return { bookmarked: false };
    } else {
      await this.supabase
        .from("feed_bookmarks")
        .insert({ user_id: userId, post_id: postId });
      return { bookmarked: true };
    }
  }

  async reportPost(userId: string, postId: string, reason: string) {
    // 본인 글 신고 불가 체크 (생략 가능하나 UX상 좋음)
    const { data: report, error } = await this.supabase
      .from("feed_reports")
      .insert({
        user_id: userId,
        post_id: postId,
        reason: reason,
      })
      .select()
      .single();

    if (error)
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);

    // 신고 누적 확인 후 자동 숨김 (예: 5회 이상)
    const { count } = await this.supabase
      .from("feed_reports")
      .select("id", { count: "exact", head: true })
      .eq("post_id", postId);

    if (count && count >= 5) {
      // 게시글 숨김 처리 (is_public = false)
      // 하지만 여기선 select에서 is_public=true만 가져오므로 효과 있음
      await this.supabase
        .from("feed_posts")
        .update({ is_public: false })
        .eq("id", postId);
      console.log(`[Auto Moderation] Post ${postId} hidden due to reports.`);
    }

    return report;
  }

  // 게시글 수정
  async updatePost(userId: string, postId: string, data: any) {
    // 본인 글인지 확인
    const { data: post, error: fetchError } = await this.supabase
      .from("feed_posts")
      .select("user_id")
      .eq("id", postId)
      .single();

    if (fetchError || !post) {
      throw new HttpException(
        "게시글을 찾을 수 없습니다.",
        HttpStatus.NOT_FOUND
      );
    }

    if (post.user_id !== userId) {
      throw new HttpException(
        "본인 글만 수정할 수 있습니다.",
        HttpStatus.FORBIDDEN
      );
    }

    // 비속어 필터링
    if (containsProfanity(data.comment)) {
      throw new HttpException(
        "바르고 고운 말을 써주세요! 비속어가 포함되어 있습니다. 🚫",
        HttpStatus.BAD_REQUEST
      );
    }

    const updateData: any = { updated_at: new Date().toISOString() };
    if (data.comment !== undefined) updateData.comment = data.comment;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.imageUrl !== undefined) updateData.image_url = data.imageUrl;

    const { data: updated, error } = await this.supabase
      .from("feed_posts")
      .update(updateData)
      .eq("id", postId)
      .select()
      .single();

    if (error)
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);

    return updated;
  }

  // 게시글 삭제
  async deletePost(userId: string, postId: string) {
    const { data: post } = await this.supabase
      .from("feed_posts")
      .select("user_id")
      .eq("id", postId)
      .single();

    if (!post) {
      throw new HttpException(
        "게시글을 찾을 수 없습니다.",
        HttpStatus.NOT_FOUND
      );
    }

    if (post.user_id !== userId) {
      throw new HttpException(
        "본인 글만 삭제할 수 있습니다.",
        HttpStatus.FORBIDDEN
      );
    }

    await this.supabase.from("feed_posts").delete().eq("id", postId);
    return { success: true };
  }

  // 댓글 목록 조회
  async getComments(postId: string, limit: number = 20, offset: number = 0) {
    const { data: comments, error } = await this.supabase
      .from("feed_comments")
      .select("*, user:user_id (nickname)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error)
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);

    return comments.map((c) => ({
      ...c,
      user: c.nickname || c.user?.nickname || "익명",
    }));
  }

  // 댓글 작성
  async createComment(userId: string, postId: string, content: string) {
    // 글자수 제한 (100자)
    if (content && content.length > 100) {
      throw new HttpException(
        "댓글은 100자까지 작성할 수 있어요! 🐷",
        HttpStatus.BAD_REQUEST
      );
    }

    // 비속어 필터링
    if (containsProfanity(content)) {
      throw new HttpException(
        "바르고 고운 말을 써주세요! 비속어가 포함되어 있습니다. 🚫",
        HttpStatus.BAD_REQUEST
      );
    }

    // 도배 방지
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const { count } = await this.supabase
      .from("feed_comments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", oneMinuteAgo);

    if (count && count >= 5) {
      throw new HttpException(
        "잠시만요! 너무 빨리 댓글을 작성하고 계셔요. 🐷",
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    // 닉네임 조회
    const user = await this.usersService.findById(userId);
    const nickname = user?.nickname || "익명 돼지";

    const { data: comment, error } = await this.supabase
      .from("feed_comments")
      .insert({
        post_id: postId,
        user_id: userId,
        nickname: nickname,
        content: content,
      })
      .select()
      .single();

    if (error)
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);

    // 댓글 수 증가
    await this.supabase.rpc("increment_comment_count", { post_id: postId });

    return comment;
  }

  // 댓글 삭제
  async deleteComment(userId: string, commentId: string) {
    const { data: comment } = await this.supabase
      .from("feed_comments")
      .select("user_id, post_id")
      .eq("id", commentId)
      .single();

    if (!comment) {
      throw new HttpException("댓글을 찾을 수 없습니다.", HttpStatus.NOT_FOUND);
    }

    if (comment.user_id !== userId) {
      throw new HttpException(
        "본인 댓글만 삭제할 수 있습니다.",
        HttpStatus.FORBIDDEN
      );
    }

    await this.supabase.from("feed_comments").delete().eq("id", commentId);

    // 댓글 수 감소
    await this.supabase.rpc("decrement_comment_count", {
      post_id: comment.post_id,
    });

    return { success: true };
  }
}
