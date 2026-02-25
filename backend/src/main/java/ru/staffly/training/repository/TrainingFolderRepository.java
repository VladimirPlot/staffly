package ru.staffly.training.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.staffly.training.model.TrainingFolder;
import ru.staffly.training.model.TrainingFolderType;

import java.util.List;
import java.util.Optional;

public interface TrainingFolderRepository extends JpaRepository<TrainingFolder, Long> {
    List<TrainingFolder> findByRestaurantIdAndTypeOrderBySortOrderAscNameAsc(Long restaurantId, TrainingFolderType type);
    List<TrainingFolder> findByRestaurantIdAndTypeAndActiveTrueOrderBySortOrderAscNameAsc(Long restaurantId, TrainingFolderType type);
    List<TrainingFolder> findByRestaurantIdAndType(Long restaurantId, TrainingFolderType type);
    List<TrainingFolder> findByRestaurantIdAndParentId(Long restaurantId, Long parentId);

    @Query("""
            select distinct f from TrainingFolder f
            left join fetch f.visibilityPositions vp
            where f.id = :id and f.restaurant.id = :restaurantId
            """)
    Optional<TrainingFolder> findByIdAndRestaurantIdWithVisibility(@Param("id") Long id, @Param("restaurantId") Long restaurantId);

    Optional<TrainingFolder> findByIdAndRestaurantId(Long id, Long restaurantId);

    @Query("""
            select distinct f from TrainingFolder f
            left join fetch f.visibilityPositions vp
            where f.restaurant.id = :restaurantId
              and f.type = :type
              and f.active = true
              and (vp.id is null or vp.id = :positionId)
            order by f.sortOrder asc, f.name asc
            """)
    List<TrainingFolder> listFoldersForStaff(@Param("restaurantId") Long restaurantId,
                                             @Param("type") TrainingFolderType type,
                                             @Param("positionId") Long positionId);

    @Query("""
            select distinct f from TrainingFolder f
            left join fetch f.visibilityPositions vp
            where f.restaurant.id = :restaurantId and f.id in :ids
            """)
    List<TrainingFolder> findAllByRestaurantIdAndIdInWithVisibility(@Param("restaurantId") Long restaurantId,
                                                                    @Param("ids") List<Long> ids);

    @Modifying(flushAutomatically = true)
    @Query("update TrainingFolder f set f.active = :active where f.restaurant.id = :restaurantId and f.id in :ids")
    int updateActiveByRestaurantIdAndIdIn(@Param("restaurantId") Long restaurantId, @Param("ids") List<Long> ids, @Param("active") boolean active);

    @Query("""
        select distinct f from TrainingFolder f
        left join fetch f.visibilityPositions vp
        where f.restaurant.id = :restaurantId
          and f.type = :type
        order by f.sortOrder asc, f.name asc
        """)
    List<TrainingFolder> findByRestaurantIdAndTypeWithVisibilityOrderBySortOrderAscNameAsc(
            @Param("restaurantId") Long restaurantId,
            @Param("type") TrainingFolderType type
    );

    @Query("""
        select distinct f from TrainingFolder f
        left join fetch f.visibilityPositions vp
        where f.restaurant.id = :restaurantId
          and f.type = :type
          and f.active = true
        order by f.sortOrder asc, f.name asc
        """)
    List<TrainingFolder> findByRestaurantIdAndTypeAndActiveTrueWithVisibilityOrderBySortOrderAscNameAsc(
            @Param("restaurantId") Long restaurantId,
            @Param("type") TrainingFolderType type
    );
}
