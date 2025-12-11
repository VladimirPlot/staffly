import React from "react";

import Card from "../../../shared/ui/Card";

type TodayShiftsCardProps = {
  todaysShifts: { memberId: number; displayName: string; shift: string }[];
  currentMemberId: number | null;
};

const TodayShiftsCard: React.FC<TodayShiftsCardProps> = ({ todaysShifts, currentMemberId }) => {
  return (
    <Card className="space-y-3">
      <div className="text-lg font-semibold text-zinc-900">Сегодня по этому графику работают:</div>
      <div className="space-y-2 text-sm text-zinc-700">
        {todaysShifts.map((item) => (
          <div
            key={item.memberId}
            className={currentMemberId && item.memberId === currentMemberId ? "font-semibold text-zinc-900" : ""}
          >
            {item.displayName} — {item.shift}
          </div>
        ))}
      </div>
    </Card>
  );
};

export default TodayShiftsCard;
