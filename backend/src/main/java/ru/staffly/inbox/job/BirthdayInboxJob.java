package ru.staffly.inbox.job;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
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
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class BirthdayInboxJob {

    private final RestaurantRepository restaurants;
    private final RestaurantMemberRepository members;
    private final InboxMessageRepository messages;
    private final InboxMessageService inboxMessages;

    @Scheduled(cron = "0 15 1 * * *")
    @Transactional
    public void generateBirthdays() {
        LocalDate today = LocalDate.now();
        LocalDate end = today.plusDays(7);

        List<Restaurant> allRestaurants = restaurants.findAll();
        for (Restaurant restaurant : allRestaurants) {
            List<RestaurantMember> membersList = members.findWithUserByRestaurantId(restaurant.getId());
            for (RestaurantMember celebrant : membersList) {
                User celebrantUser = celebrant.getUser();
                if (celebrantUser == null || celebrantUser.getBirthDate() == null) {
                    continue;
                }

                MonthDay birthDay = MonthDay.from(celebrantUser.getBirthDate());
                LocalDate computedBirthday = birthDay.atYear(today.getYear());
                if (computedBirthday.isBefore(today)) {
                    computedBirthday = computedBirthday.plusYears(1);
                }
                if (computedBirthday.isAfter(end)) {
                    continue;
                }

                final LocalDate nextBirthday = computedBirthday;

                String meta = "birthday:" + celebrant.getId() + ":" + nextBirthday.getYear();
                InboxMessage message = messages.findByRestaurantIdAndTypeAndMeta(
                        restaurant.getId(),
                        InboxMessageType.BIRTHDAY,
                        meta
                ).orElseGet(() -> inboxMessages.createBirthdayMessage(
                        restaurant,
                        String.format("Скоро день рождения у %s", celebrantUser.getFullName()),
                        nextBirthday,
                        meta,
                        List.of()
                ));

                for (RestaurantMember recipient : membersList) {
                    if (recipient.getId().equals(celebrant.getId())) {
                        continue;
                    }
                    inboxMessages.ensureRecipient(message, recipient);
                }
            }
        }

        log.info("Birthday inbox job completed");
    }
}
