import { useState, useEffect } from "react";
import type { ConversationSummary } from "../../../shared/types";
import { getHistoriesUrl } from "../config/api";

export function useConversationList(encodedName: string | null) {
    const [conversations, setConversations] = useState<ConversationSummary[]>(
        [],
    );
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!encodedName) {
            setConversations([]);
            return;
        }

        const loadConversations = async () => {
            try {
                setLoading(true);
                setError(null);

                const response = await fetch(getHistoriesUrl(encodedName));
                if (!response.ok) {
                    throw new Error("Failed to load conversations");
                }

                const data = await response.json();
                setConversations(data.conversations || []);
            } catch (err) {
                setError(
                    err instanceof Error ? err.message : "Failed to load conversations",
                );
            } finally {
                setLoading(false);
            }
        };

        loadConversations();
    }, [encodedName]);

    return { conversations, loading, error };
}
