import React from "react";
import { fetchRestaurantName } from "../../restaurants/api";
import { fetchMyRoleIn } from "../../employees/api";
import type { RestaurantRole } from "../../../shared/types/restaurant";
import { resolveRestaurantAccess } from "../../../shared/utils/access";
import { fetchInbox, fetchInboxMarkers, type InboxMessageDto } from "../../inbox/api";
import { listSavedSchedules, type ScheduleSummary } from "../../schedule/api";
import { fetchUnreadAnonymousLetters } from "../../anonymousLetters/api";

const ANNOUNCEMENTS_REQUEST = {
  type: "ANNOUNCEMENT",
  state: "UNREAD",
  page: 0,
  size: 3,
} as const;

type UseRestaurantHomeDataParams = {
  restaurantId: number | null;
  userRoles?: Array<string | null | undefined> | null;
};

type UseRestaurantHomeDataResult = {
  restaurantName: string;
  myRole: RestaurantRole | null;
  access: ReturnType<typeof resolveRestaurantAccess>;
  announcementsPreview: InboxMessageDto[];
  savedSchedules: ScheduleSummary[];
  hasUnreadAnonymousLetters: boolean;
  hasUnreadScheduleEvents: boolean;
};

export function useRestaurantHomeData({
  restaurantId,
  userRoles,
}: UseRestaurantHomeDataParams): UseRestaurantHomeDataResult {
  const [restaurantName, setRestaurantName] = React.useState("");
  const [myRole, setMyRole] = React.useState<RestaurantRole | null>(null);
  const [announcementsPreview, setAnnouncementsPreview] = React.useState<InboxMessageDto[]>([]);
  const [savedSchedules, setSavedSchedules] = React.useState<ScheduleSummary[]>([]);
  const [hasUnreadAnonymousLetters, setHasUnreadAnonymousLetters] = React.useState(false);
  const [hasUnreadScheduleEvents, setHasUnreadScheduleEvents] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    if (!restaurantId) {
      setRestaurantName("");
      return () => {
        alive = false;
      };
    }

    (async () => {
      try {
        const name = await fetchRestaurantName(restaurantId);
        if (alive) setRestaurantName(name);
      } catch {
        if (alive) setRestaurantName("");
      }
    })();

    return () => {
      alive = false;
    };
  }, [restaurantId]);

  React.useEffect(() => {
    let alive = true;
    if (!restaurantId) {
      setMyRole(null);
      return () => {
        alive = false;
      };
    }

    (async () => {
      try {
        const role = await fetchMyRoleIn(restaurantId);
        if (alive) setMyRole(role);
      } catch {
        if (alive) setMyRole(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, [restaurantId]);

  const access = React.useMemo(
    () => resolveRestaurantAccess(userRoles ?? undefined, myRole),
    [userRoles, myRole]
  );

  React.useEffect(() => {
    let alive = true;
    if (!restaurantId) {
      setAnnouncementsPreview([]);
      return () => {
        alive = false;
      };
    }

    (async () => {
      try {
        const { items } = await fetchInbox(restaurantId, ANNOUNCEMENTS_REQUEST);
        if (alive) setAnnouncementsPreview(items);
      } catch {
        if (alive) setAnnouncementsPreview([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, [restaurantId]);

  const canAccessSchedules = access.isAdminLike || Boolean(access.normalizedRestaurantRole);

  React.useEffect(() => {
    let alive = true;
    if (!restaurantId || !canAccessSchedules) {
      setSavedSchedules([]);
      return () => {
        alive = false;
      };
    }

    (async () => {
      try {
        const schedules = await listSavedSchedules(restaurantId);
        if (alive) setSavedSchedules(schedules);
      } catch {
        if (alive) setSavedSchedules([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, [restaurantId, canAccessSchedules]);

  React.useEffect(() => {
    let alive = true;
    if (!restaurantId || access.normalizedRestaurantRole !== "ADMIN") {
      setHasUnreadAnonymousLetters(false);
      return () => {
        alive = false;
      };
    }

    (async () => {
      try {
        const { hasUnread } = await fetchUnreadAnonymousLetters(restaurantId);
        if (alive) setHasUnreadAnonymousLetters(hasUnread);
      } catch {
        if (alive) setHasUnreadAnonymousLetters(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [restaurantId, access.normalizedRestaurantRole]);

  React.useEffect(() => {
    let alive = true;
    if (!restaurantId) {
      setHasUnreadScheduleEvents(false);
      return () => {
        alive = false;
      };
    }

    (async () => {
      try {
        const data = await fetchInboxMarkers(restaurantId);
        if (alive) setHasUnreadScheduleEvents(data.hasScheduleEvents);
      } catch {
        if (alive) setHasUnreadScheduleEvents(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [restaurantId]);

  return {
    restaurantName,
    myRole,
    access,
    announcementsPreview,
    savedSchedules,
    hasUnreadAnonymousLetters,
    hasUnreadScheduleEvents,
  };
}
