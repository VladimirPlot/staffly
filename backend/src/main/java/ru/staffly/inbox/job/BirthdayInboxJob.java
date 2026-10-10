package ru.staffly.inbox.job;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.time.RestaurantTimeService;
import ru.staffly.inbox.model.InboxMessage;
import ru.staffly.inbox.model.InboxMessageType;
import ru.staffly.inbox.repository.InboxMessageRepository;
import ru.staffly.inbox.service.InboxMessageService;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.restaurant.repository.RestaurantRepository;
import ru.staffly.user.model.User;

import java.time.LocalDate;
import java.time.MonthDay;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class BirthdayInboxJob {

    private final RestaurantRepository restaurants;
    private final RestaurantMemberRepository members;
    private final InboxMessageRepository messages;
    private final InboxMessageService inboxMessages;
    private final RestaurantTimeService restaurantTime;

    @Scheduled(cron = "0 15 * * * *")
    @Transactional
    public void generateBirthdays() {
        List<Restaurant> allRestaurants = restaurants.findAll();
        for (Restaurant restaurant : allRestaurants) {
            ZoneId zone = restaurantTime.zoneFor(restaurant);
            ZonedDateTime now = restaurantTime.nowInstant().atZone(zone);
            if (now.getHour() != 1) {
                continue;
            }
            LocalDate today = now.toLocalDate();
            LocalDate weekAhead = today.plusDays(7);
            LocalDate tomorrow = today.plusDays(1);

            List<RestaurantMember> membersList = members.findActiveWithUserByRestaurantId(restaurant.getId());
            List<RestaurantMember> todaysCelebrants = findCelebrantsByDate(membersList, today);
            List<RestaurantMember> tomorrowCelebrants = findCelebrantsByDate(membersList, tomorrow);
            List<RestaurantMember> weekCelebrants = findCelebrantsByDate(membersList, weekAhead);

            for (RestaurantMember celebrant : weekCelebrants) {
                createBirthdayMessage(
                        restaurant,
                        celebrant,
                        membersList,
                        weekAhead,
                        BirthdayKind.WEEK,
                        String.format("Через неделю у %s день рождения", celebrant.getUser().getFullName())
                );
            }

            for (RestaurantMember celebrant : tomorrowCelebrants) {
                createBirthdayMessage(
                        restaurant,
                        celebrant,
                        membersList,
                        tomorrow,
                        BirthdayKind.TOMORROW,
                        String.format("Завтра у %s день рождения", celebrant.getUser().getFullName())
                );
            }

            for (RestaurantMember celebrant : todaysCelebrants) {
                createBirthdayMessage(
                        restaurant,
                        celebrant,
                        membersList,
                        today,
                        BirthdayKind.TODAY,
                        String.format("Сегодня у %s день рождения 🎉", celebrant.getUser().getFullName())
                );
                createBirthdayMessage(
                        restaurant,
                        celebrant,
                        List.of(celebrant),
                        today,
                        BirthdayKind.GREET,
                        "С днём рождения! Здоровья, любви, успехов!"
                );
            }
        }

        log.info("Birthday inbox job completed");
    }

    private List<RestaurantMember> findCelebrantsByDate(List<RestaurantMember> membersList, LocalDate targetDate) {
        MonthDay targetMonthDay = MonthDay.from(targetDate);
        List<RestaurantMember> celebrants = new ArrayList<>();
        for (RestaurantMember member : membersList) {
            User user = member.getUser();
            if (user == null || user.getBirthDate() == null) {
                continue;
            }
            if (MonthDay.from(user.getBirthDate()).equals(targetMonthDay)) {
                celebrants.add(member);
            }
        }
        return celebrants;
    }

    private void createBirthdayMessage(Restaurant restaurant,
                                       RestaurantMember celebrant,
                                       List<RestaurantMember> allRecipients,
                                       LocalDate targetDate,
                                       BirthdayKind kind,
                                       String content) {
        List<RestaurantMember> recipients = allRecipients.stream()
                .filter(member -> member.getUser() != null)
                .filter(member -> kind == BirthdayKind.GREET || !member.getId().equals(celebrant.getId()))
                .toList();
        if (recipients.isEmpty()) {
            return;
        }

        String meta = String.format(
                "birthday:%d:%s:%s",
                celebrant.getId(),
                targetDate,
                kind.name()
        );

        InboxMessage message = messages.findByRestaurantIdAndTypeAndMeta(
                restaurant.getId(),
                InboxMessageType.BIRTHDAY,
                meta
        ).orElse(null);

        if (message == null) {
            inboxMessages.createBirthdayMessage(
                    restaurant,
                    content,
                    targetDate,
                    meta,
                    recipients
            );
        } else if (kind == BirthdayKind.GREET) {
            inboxMessages.ensureRecipient(message, celebrant);
        } else {
            inboxMessages.ensureRecipientsBulk(message, recipients);
        }
    }

    private enum BirthdayKind {
        WEEK,
        TOMORROW,
        TODAY,
        GREET
    }
}
