import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { Room } from "../types";

export const useRooms = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRooms = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("rooms")
      .select("*")
      .order("title", { ascending: false });

    if (error) {
      console.error("Error fetching rooms:", error);
    }

    setRooms(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  return {
    rooms,
    refetch: fetchRooms,
    loading,
  };
};
