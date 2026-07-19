import { supabase } from "./supabaseClient";
import { DEFAULT_MAP, MapKind } from "./mapKind";

export const  createMeeting = async (
  title: string,
  map: MapKind = DEFAULT_MAP
): Promise<string> => {
  try {
    const { data } = await supabase.functions.invoke("create-meeting", {
      body: {
        title,
        map,
      },
    });
    return data.meeting_id;
  } catch (error) {
    console.error("Error joining room:", error);

    throw new Error("Failed to create meeting");
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
