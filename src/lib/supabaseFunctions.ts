import { supabase } from "./supabaseClient";
import { DEFAULT_MAP, MapKind } from "./mapKind";

export const  createMeeting = async (
  title: string,
  map: MapKind = DEFAULT_MAP
): Promise<string> => {
  try {
    const { data, error } = await supabase.functions.invoke("create-meeting", {
      body: {
        title,
        map,
      },
    });

    // 방 목록은 DB에서 다시 읽으므로, Edge Function이 선택 맵을 실제 저장했음을
    // 응답으로 확인해야 한다. 구버전 함수가 meeting_id만 반환하면 생성 직후에는
    // Office로 보이다가 로비 재조회 후 기본 Village로 바뀌는 데이터 손실이 생긴다.
    if (error || !data?.meeting_id || data.map !== map) {
      throw error ?? new Error("Map persistence was not confirmed");
    }

    return data.meeting_id;
  } catch (error) {
    console.error("Error creating room:", error);

    throw new Error("Failed to create meeting with the selected map");
  }
};

export const createRTKToken = async (meetingId: string, userId: string, userName: string): Promise<string> => {
  try {
    const { data } = await supabase.functions.invoke("create-rtk-token", {
      body: {
        meeting_id: meetingId,
        user_id: userId,
        user_name: userName,
      },
    });
    return data.authToken;
  } catch (error) {
    console.error("Error creating RTK token:", error);

    throw new Error("Failed to create RTK token");
  }
}
