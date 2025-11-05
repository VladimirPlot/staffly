//package ru.staffly.avatar.controller;
//
//import lombok.RequiredArgsConstructor;
//import org.springframework.http.MediaType;
//import org.springframework.http.ResponseEntity;
//import org.springframework.security.access.prepost.PreAuthorize;
//import org.springframework.security.core.annotation.AuthenticationPrincipal;
//import org.springframework.transaction.annotation.Transactional;
//import org.springframework.web.bind.annotation.*;
//import org.springframework.web.multipart.MultipartFile;
//import ru.staffly.avatar.service.AvatarService;
//import ru.staffly.member.repository.RestaurantMemberRepository;
//import ru.staffly.security.UserPrincipal;
//
//import java.util.Map;
//
//@RestController
//@RequestMapping("/api/users/me")
//@RequiredArgsConstructor
//public class AvatarController {
//
//    private final AvatarService avatars;
//    private final RestaurantMemberRepository memberRepository;
//
//    @PreAuthorize("isAuthenticated()")
//    @PostMapping(value = "/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
//    @Transactional
//    public ResponseEntity<Map<String, String>> upload(@AuthenticationPrincipal UserPrincipal principal,
//                                                      @RequestPart("file") MultipartFile file) {
//        String url = avatars.uploadUserAvatar(principal.userId(), file);
//
//        // Если выбран ресторан — обновим аватар только там; иначе во всех членствах
//        Long userId = principal.userId();
//        Long restaurantId = principal.restaurantId();
//
//        if (restaurantId != null) {
//            memberRepository.findByUserIdAndRestaurantId(userId, restaurantId)
//                    .ifPresent(m -> {
//                        m.setAvatarUrl(url);
//                        memberRepository.save(m);
//                    });
//        } else {
//            var all = memberRepository.findByUserId(userId);
//            if (!all.isEmpty()) {
//                all.forEach(m -> m.setAvatarUrl(url));
//                memberRepository.saveAll(all);
//            }
//        }
//
//        return ResponseEntity.ok(Map.of("avatarUrl", url));
//    }
//}