-- RPC to create a team group atomically
CREATE OR REPLACE FUNCTION create_team_group(
    group_name TEXT,
    member_ids UUID[],
    creator_id UUID
) RETURNS UUID AS $$
DECLARE
    new_channel_id UUID;
    member_id UUID;
BEGIN
    -- 1. Create the channel
    INSERT INTO chat_channels (type, name, created_by)
    VALUES ('team', group_name, creator_id)
    RETURNING id INTO new_channel_id;

    -- 2. Add the creator as a member (admin role logic can be handled by app, but here just membership)
    INSERT INTO chat_members (channel_id, user_id)
    VALUES (new_channel_id, creator_id);

    -- 3. Add other members
    FOREACH member_id IN ARRAY member_ids
    LOOP
        -- Avoid duplicate if creator is in the list
        IF member_id != creator_id THEN
            INSERT INTO chat_members (channel_id, user_id)
            VALUES (new_channel_id, member_id);
        END IF;
    END LOOP;

    RETURN new_channel_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
