import React from "react";

import Card from "../../../shared/ui/Card";

type TodayShiftsCardProps = {
  todaysShifts: { rowKey: string; historical: boolean; memberId: number; displayName: string; shift: string }[];
  currentMemberId: number | null;
};

const TodayShiftsCard: React.FC<TodayShiftsCardProps> = ({ todaysShifts, currentMemberId }) => {
  return (
    <Card className="space-y-3">
      <div className="text-lg font-semibold text-strong">Сегодня по этому графику работают:</div>
      <div className="space-y-2 text-sm text-default">
        {todaysShifts.map((item) => (
          <div
            key={item.rowKey}
            className={!item.historical && currentMemberId && item.memberId === currentMemberId ? "font-semibold text-strong" : ""}
          >
            {item.displayName} — {item.shift}
          </div>
        ))}
      </div>
    </Card>
  );
};

export default TodayShiftsCard;
