"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Returns the user's nickname from Supabase profile.
 * Falls back to Google metadata, then email prefix.
 * Returns null while loading, empty string if not logged in.
 */
export function useNickname() {
  const [nickname, setNickname] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setNickname("");
      return;
    }

    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      if (!user) {
        setNickname("");
        return;
      }
      setUserId(user.id);
      // Use metadata as default
      const name =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split("@")[0] ||
        "用户";
      setNickname(name);

      // Then try to get display_name from profiles table (may be customized)
      supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .single()
        .then(({ data: profile }) => {
          if (profile?.display_name) {
            setNickname(profile.display_name);
          }
        });
    });
  }, []);

  return { nickname, userId };
}
